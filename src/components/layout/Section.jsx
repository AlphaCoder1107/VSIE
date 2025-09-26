export default function Section({ id, eyebrow, title, description, children, className = '' }) {
  return (
    <section id={id} className={`py-16 md:py-24 ${className}`}>
      <div className="container">
        {(eyebrow || title || description) && (
          <header className="max-w-3xl">
            {eyebrow && <p className="text-sm text-vsie-accent font-medium">{eyebrow}</p>}
            {title && <h2 className="mt-2 text-3xl md:text-5xl font-bold tracking-tight">{title}</h2>}
            {description && <p className="mt-3 text-vsie-muted">{description}</p>}
          </header>
        )}
        {children && <div className="mt-10">{children}</div>}
      </div>
    </section>
  )
}
