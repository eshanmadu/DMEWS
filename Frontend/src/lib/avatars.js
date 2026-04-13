import man1 from "@/img/users/man1.png";
import man2 from "@/img/users/man2.png";
import man3 from "@/img/users/man3.png";
import man4 from "@/img/users/man4.png";
import girl1 from "@/img/users/girl1.png";
import girl2 from "@/img/users/girl2.png";
import girl3 from "@/img/users/girl3.png";
import girl4 from "@/img/users/girl4.png";

export const AVATARS = [
  { id: "man1", label: "Man 1", src: man1 },
  { id: "man2", label: "Man 2", src: man2 },
  { id: "man3", label: "Man 3", src: man3 },
  { id: "man4", label: "Man 4", src: man4 },
  { id: "girl1", label: "Girl 1", src: girl1 },
  { id: "girl2", label: "Girl 2", src: girl2 },
  { id: "girl3", label: "Girl 3", src: girl3 },
  { id: "girl4", label: "Girl 4", src: girl4 },
];

export function avatarSrcById(id) {
  const found = AVATARS.find((a) => a.id === id);
  if (found?.src) return found.src;
  const raw = String(id || "").trim();
  if (/^https?:\/\//i.test(raw)) return raw;
  return null;
}

