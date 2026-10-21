/* Reference layers and exact provisional watershed. No prediction API or station snapping. */
'use strict';
async function start() {
  const status = document.getElementById('load-status');
  if (!window.L) throw new Error('Local Leaflet assets did not load. Check server output.');
  const map = L.map('map', {preferCanvas: true, minZoom: 7, maxZoom: 18});
  map.setView([6.7, 80.35], 10);
  L.control.scale({imperial: false}).addTo(map);
  map.attributionControl.addAttribution('HydroSHEDS © WWF | Reference geography');
  async function load(name) {
    const response = await fetch('/data/' + name);
    if (!response.ok) throw new Error(name + ': HTTP ' + response.status);
    return response.json();
  }
  const [basins, reference, rivers, stations, manifest, watershed] = await Promise.all([
    load('kalu_reference.geojson'), load('ratnapura_reference.geojson'),
    load('hydrorivers_kalu.geojson'), load('stations.geojson'), load('manifest.json'), load('ratnapura_v2.geojson')]);
  document.getElementById('attribution').textContent = manifest.license.notice;
  document.getElementById('provenance').textContent = 'V2 export: ' + manifest.layers['ratnapura_v2.geojson'].exported_utc + ' · WGS84 · Exact unsimplified cell footprint';
  function showDetails(feature, title) {
    const panel = document.getElementById('details');
    panel.replaceChildren();
    const heading = document.createElement('h3'); heading.textContent = title; panel.append(heading);
    const list = document.createElement('dl');
    const properties = {...feature.properties};
    if (feature.geometry.type === 'Point') {
      properties.longitude = feature.geometry.coordinates[0];
      properties.latitude = feature.geometry.coordinates[1];
    }
    Object.entries(properties).forEach(([key, value]) => {
      const term = document.createElement('dt'); term.textContent = key.replaceAll('_', ' ');
      const definition = document.createElement('dd'); definition.textContent = String(value);
      list.append(term, definition);
    });
    panel.append(list);
  }
  function clickable(title) {
    return (feature, layer) => {
      layer.on('click', () => showDetails(feature, feature.properties.name || title));
      const content = document.createElement('div');
      const label = document.createElement('strong'); label.textContent = feature.properties.name || title;
      const hint = document.createElement('p');
      hint.textContent = feature.properties.uncertainty || feature.properties.status;
      content.append(label, hint); layer.bindPopup(content);
    };
  }
  const kalu = L.geoJSON(basins, {style: {color: '#687a78', weight: 1.5, dashArray: '6 5', fillOpacity: 0.035}, onEachFeature: clickable('Kalu reference basin')});
  const ratnapura = L.geoJSON(reference, {style: {color: '#ae770f', weight: 2, dashArray: '7 5', fillColor: '#e8be5b', fillOpacity: 0.1}, onEachFeature: clickable('Ratnapura six-polygon reference')});
  // Disable Leaflet's display simplification for the authoritative V2 boundary.
  const watershedLayer = L.geoJSON(watershed, {smoothFactor: 0, style: {color: '#7437a8', weight: 2.5, fillColor: '#a66cce', fillOpacity: 0.23}, onEachFeature: clickable('Ratnapura V2 Provisional Watershed')});
  const riverLayer = L.geoJSON(rivers, {style: f => ({color: '#2785bd', weight: Math.max(1, Math.min(3, f.properties.ORD_STRA / 2)), opacity: 0.85}), onEachFeature: clickable('HydroRIVERS reference reach')});
  const styles = {
    ratnapura_annual: {color: '#b84839', fillColor: '#fff', fillOpacity: 1, radius: 7, weight: 3},
    ratnapura_dmc: {color: '#cf6e27', fillColor: '#ffe1bd', fillOpacity: 1, radius: 8, weight: 2},
    ellagawa: {color: '#177966', fillColor: '#177966', fillOpacity: 1, radius: 7},
    v2: {color: '#61328e', fillColor: '#a56cd2', fillOpacity: 1, radius: 9, weight: 3}
  };
  const stationLayer = L.geoJSON(stations, {
    pointToLayer: (f, latlng) => L.circleMarker(latlng, styles[f.properties.id]),
    onEachFeature: (f, layer) => {
      clickable('Station or provisional outlet')(f, layer);
      layer.bindTooltip(f.properties.name, {direction: 'top'});
    }
  });
  const layers = [['Kalu reference boundary', kalu], ['Ratnapura reference (six polygons)', ratnapura],
                  ['Provisional V2 Watershed', watershedLayer],
                  ['HydroRIVERS reference network', riverLayer], ['Stations and provisional V2 marker', stationLayer]];
  layers.forEach(([name, layer], i) => {
    layer.addTo(map);
    const label = document.createElement('label');
    const input = document.createElement('input'); input.type = 'checkbox'; input.checked = true; input.id = 'layer-' + i;
    input.addEventListener('change', () => input.checked ? map.addLayer(layer) : map.removeLayer(layer));
    const text = document.createElement('span'); text.textContent = name; label.append(input, text);
    document.getElementById('layers').append(label);
  });
  function fit(layer) { map.fitBounds(layer.getBounds(), {padding: [28, 28], maxZoom: 14}); }
  const v2 = stations.features.find(f => f.properties.id === 'v2');
  document.getElementById('fit-kalu').onclick = () => fit(kalu);
  document.getElementById('fit-ratnapura').onclick = () => fit(ratnapura);
  document.getElementById('fit-v2-watershed').onclick = () => {
    fit(watershedLayer);
    showDetails(watershed.features[0], 'Ratnapura V2 Provisional Watershed');
  };
  document.getElementById('fit-v2').onclick = () => {
    map.setView([v2.geometry.coordinates[1], v2.geometry.coordinates[0]], 16);
    showDetails(v2, v2.properties.name);
  };
  document.querySelectorAll('.buttons button').forEach(button => { button.disabled = false; });
  fit(kalu);
  status.textContent = basins.features.length + ' basins · ' + rivers.features.length + ' rivers · exact V2 · 4 markers';
  // Public debug handle supports read-only interaction testing without exporting model data.
  window.researchMap = {map, layers: {kalu, ratnapura, watershed: watershedLayer, rivers: riverLayer, stations: stationLayer}};
}
start().catch(error => {
  const status = document.getElementById('load-status');
  status.textContent = 'Map unavailable: ' + error.message; status.classList.add('error');
  console.error(error);
});
