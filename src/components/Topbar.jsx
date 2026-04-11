// src/components/Topbar.jsx
export default function Topbar({ title, action }) {
  return (
    <div className="h-12 bg-white border-b border-slate-200 px-5 flex items-center justify-between flex-shrink-0">
      <h1 className="text-[14px] font-bold text-navy-900">{title}</h1>
      {action && <div>{action}</div>}
    </div>
  )
}
