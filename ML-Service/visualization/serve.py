"""Local-only, allowlisted reference-map server. No directory browsing."""
from pathlib import Path
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlsplit
import argparse
import mimetypes

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
DATA = ROOT / 'outputs/visualization'


def routes():
    # npm workspaces may hoist Leaflet to repository/node_modules.
    candidates = [ROOT.parent / 'node_modules/leaflet/dist',
                  ROOT.parent / 'Frontend/node_modules/leaflet/dist']
    leaflet = next((p for p in candidates if (p / 'leaflet.js').is_file()
                    and (p / 'leaflet.css').is_file()), None)
    if leaflet is None:
        raise FileNotFoundError('Local Leaflet JS/CSS unavailable. No replacement downloaded.')
    import json
    if json.loads((leaflet.parent / 'package.json').read_text())['version'] != '1.9.4':
        raise ValueError('Expected installed Leaflet 1.9.4')
    files = {'/': HERE / 'index.html', '/index.html': HERE / 'index.html'}
    for name in ('styles.css', 'app.js'):
        files['/' + name] = HERE / name
    for name in ('kalu_reference.geojson', 'ratnapura_reference.geojson',
                 'hydrorivers_kalu.geojson', 'stations.geojson', 'ratnapura_v2.geojson', 'manifest.json'):
        files['/data/' + name] = DATA / name
    # Only these two unchanged validated historical images; no output-directory browsing.
    for name in ('ratnapura_stage_month_hydrograph.svg', 'ratnapura_stage_month_hydrograph.png'):
        files['/charts/' + name] = DATA / name
    for name in ('leaflet.js', 'leaflet.css'):
        files['/leaflet/' + name] = leaflet / name
    # CSS references these explicitly; no arbitrary path traversal into node_modules.
    for name in ('layers.png', 'layers-2x.png', 'marker-icon.png', 'marker-icon-2x.png', 'marker-shadow.png'):
        files['/leaflet/images/' + name] = leaflet / 'images' / name
    missing = [str(p) for p in files.values() if not p.is_file()]
    if missing:
        raise FileNotFoundError('Required resources missing: ' + ', '.join(missing))
    return files


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--port', type=int, default=8765)
    args = parser.parse_args()
    allowed = routes()

    class Handler(BaseHTTPRequestHandler):
        def respond(self, body=True):
            path = urlsplit(self.path).path
            target = allowed.get(path)  # Deliberately no decoding or filesystem path joining.
            if target is None:
                self.send_error(404, 'Not an allowed visualization resource')
                return
            data = target.read_bytes()
            image_types = {'.svg': 'image/svg+xml', '.png': 'image/png'}
            kind = ('application/geo+json' if target.suffix == '.geojson' else
                    image_types.get(target.suffix) or mimetypes.guess_type(target.name)[0])
            self.send_response(200)
            self.send_header('Content-Type', (kind or 'application/octet-stream') +
                             ('; charset=utf-8' if target.suffix in ('.html', '.css', '.js', '.json', '.geojson') else ''))
            self.send_header('Content-Length', str(len(data)))
            self.send_header('Cache-Control', 'no-store')
            self.send_header('X-Content-Type-Options', 'nosniff')
            self.send_header('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'; frame-ancestors 'none'")
            self.end_headers()
            if body:
                self.wfile.write(data)

        def do_GET(self):
            self.respond()

        def do_HEAD(self):
            self.respond(False)

    server = ThreadingHTTPServer(('127.0.0.1', args.port), Handler)
    print('Reference map: http://127.0.0.1:%d (Ctrl+C to stop)' % server.server_port, flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == '__main__':
    main()
