export default function Ornament({ className = '' }) {
  return (
    <svg className={`ornament ${className}`} viewBox="0 0 220 220" aria-hidden="true">
      <defs>
        <path id="petal" d="M110 21c18 31 18 57 0 78-18-21-18-47 0-78Z" />
      </defs>
      <g fill="none" stroke="currentColor" strokeWidth="1.2" opacity=".72">
        <circle cx="110" cy="110" r="82"/>
        <circle cx="110" cy="110" r="58"/>
        <use href="#petal"/><use href="#petal" transform="rotate(45 110 110)"/><use href="#petal" transform="rotate(90 110 110)"/><use href="#petal" transform="rotate(135 110 110)"/><use href="#petal" transform="rotate(180 110 110)"/><use href="#petal" transform="rotate(225 110 110)"/><use href="#petal" transform="rotate(270 110 110)"/><use href="#petal" transform="rotate(315 110 110)"/>
        <path d="M52 52 168 168M168 52 52 168M28 110h164M110 28v164"/>
      </g>
    </svg>
  );
}
