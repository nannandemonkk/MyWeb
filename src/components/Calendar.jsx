import { useState } from "react";
import { dateKey, parsePostDate } from "../lib/posts";
import Icon from "./Icon";

export default function Calendar({ posts, loading, error, selectedDate, onSelect }) {
  const today = new Date();
  const [month, setMonth] = useState(() => {
    const initial = parsePostDate(selectedDate) || today;
    return new Date(initial.getFullYear(), initial.getMonth(), 1);
  });
  const [expanded, setExpanded] = useState(false);
  const [previousSelection, setPreviousSelection] = useState(selectedDate);
  // Follow a newly selected URL date, but do not override manual month navigation.
  if (previousSelection !== selectedDate) {
    setPreviousSelection(selectedDate);
    const selected = parsePostDate(selectedDate);
    if (selected) setMonth(new Date(selected.getFullYear(), selected.getMonth(), 1));
  }
  const recorded = new Map();
  for (const post of loading || error ? [] : posts) {
    const date = parsePostDate(post.date);
    if (date) recorded.set(dateKey(date), (recorded.get(dateKey(date)) || 0) + 1);
  }
  const firstWeekday = (month.getDay() + 6) % 7;
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells = Math.ceil((firstWeekday + daysInMonth) / 7) * 7;
  const dates = Array.from({ length: cells }, (_, index) => new Date(month.getFullYear(), month.getMonth(), index - firstWeekday + 1));
  const monthKey = dateKey(month).slice(0, 7);
  const recordedCount = [...recorded.keys()].filter((key) => key.startsWith(monthKey)).length;
  const title = `${month.getFullYear()} 年 ${month.getMonth() + 1} 月`;

  function moveMonth(delta) {
    setMonth(new Date(month.getFullYear(), month.getMonth() + delta, 1));
  }

  return (
    <section className={`side-card calendar-card${expanded ? " expanded" : ""}`} aria-labelledby="calendar-title">
      <div className="card-heading"><h2 id="calendar-title">记录日历</h2><Icon />
        <button className="calendar-toggle" aria-expanded={expanded} aria-controls="calendar-body" onClick={() => setExpanded(!expanded)}>{expanded ? "收起" : "展开"}<Icon name="down" /></button>
      </div>
      <div className="calendar-body" id="calendar-body">
        <div className="month-nav"><span>{title}</span><div>
          <button className="icon-button" onClick={() => moveMonth(-1)} aria-label="上个月"><Icon name="left" /></button>
          <button className="icon-button" onClick={() => moveMonth(1)} aria-label="下个月"><Icon name="right" /></button>
        </div></div>
        <div className="calendar-grid" role="group" aria-label={`${title}记录日历`}>
          {["一", "二", "三", "四", "五", "六", "日"].map((day) => <span key={day} className="weekday" aria-hidden="true">{day}</span>)}
          {dates.map((date) => {
            const key = dateKey(date);
            const outside = date.getMonth() !== month.getMonth();
            const isToday = key === dateKey(today);
            const count = recorded.get(key) || 0;
            return <button key={key} className={`calendar-day${outside ? " outside" : ""}${count ? " recorded" : ""}${isToday ? " today" : ""}`} aria-label={`${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日，${loading || error ? "记录数量暂不可用" : `${count}篇记录`}`} aria-pressed={selectedDate === key} aria-current={isToday ? "date" : undefined} onClick={() => {
              onSelect(selectedDate === key ? null : key);
              if (outside) setMonth(new Date(date.getFullYear(), date.getMonth(), 1));
            }}>{date.getDate()}</button>;
          })}
        </div>
        <div className="calendar-foot" role="status"><span className="small-dot" /><span>{loading ? "正在读取记录…" : error ? "记录读取失败，暂时无法统计" : <>这个月，记录了 <strong>{recordedCount}</strong> 天</>}</span></div>
        <p className="calendar-note">{error ? "请在文章列表重新加载；日历日期筛选仍可使用。" : "按文档日期统计，未标注日期的记录不计入。"}</p>
        {selectedDate && <button className="text-button calendar-clear" onClick={() => onSelect(null)}>取消日期筛选 <Icon name="close" /></button>}
      </div>
    </section>
  );
}
