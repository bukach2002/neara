export function PublicHeader() {
  return (
    <header className="topbar">
      <a className="brand-row brand-row-dark" href="/">
        <span className="brand-mark brand-mark-dark">N</span>
        <span>Neara</span>
      </a>
      <nav>
        <a href="/search">Search</a>
        <a href="/booking-lookup">Find booking</a>
      </nav>
    </header>
  );
}
