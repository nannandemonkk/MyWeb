import { SCENES } from "../lib/appearance";
import Icon from "./Icon";

export default function ScenePicker({ appearance }) {
  return (
    <div className="scene-picker" aria-label="选择背景时段">
      {Object.entries(SCENES).map(([key, value]) => (
        <button key={key} onClick={() => appearance.setMode(key)} aria-pressed={appearance.mode === key}>
          <Icon name={value.icon} /><span>{value.label}</span>
        </button>
      ))}
    </div>
  );
}
