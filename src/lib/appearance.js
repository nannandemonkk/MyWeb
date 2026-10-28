export const SCENES = {
  morning: { label: "晨光", icon: "sunrise", caption: "新的一天，慢慢开始。", copy: "早安，给新的一天留一点期待。" },
  afternoon: { label: "午后", icon: "sun", caption: "午后的光，刚刚好。", copy: "阳光正好，适合写下一个小小的念头。" },
  evening: { label: "黄昏", icon: "sunset", caption: "日落之前，把心事写完。", copy: "把今天的小确幸，留在日落之前。" },
  night: { label: "夜晚", icon: "moon", caption: "晚风轻轻，心事慢慢。", copy: "世界安静下来，听一听自己的声音。" },
};

export function timeScene(date) {
  const hour = date.getHours();
  if (hour >= 5 && hour < 11) return "morning";
  if (hour >= 11 && hour < 17) return "afternoon";
  if (hour >= 17 && hour < 20) return "evening";
  return "night";
}
