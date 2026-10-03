export default function SectionTitle({ eyebrow, title, body, center = false, as: Heading = 'h2' }) {
  return (
    <div className={`section-title ${center ? 'center' : ''}`}>
      {eyebrow && <span className="eyebrow">{eyebrow}</span>}
      <Heading>{title}</Heading>
      {body && <p>{body}</p>}
    </div>
  );
}
