import { HomeSearchForm } from './components/HomeSearchForm';

const categories = ['Salon', 'Wellness', 'Clinic', 'Consulting'];

export default function HomePage() {
  return (
    <main className="public-shell">
      <section className="search-band">
        <div className="brand-row">
          <span className="brand-mark">N</span>
          <span>Neara</span>
        </div>
        <div className="search-copy">
          <h1>Book trusted local appointments</h1>
          <p>Search nearby services, compare experts, and reserve a confirmed slot without creating an account.</p>
        </div>
        <HomeSearchForm />
      </section>

      <section className="content-band" aria-label="Popular categories">
        <div className="section-heading">
          <h2>Popular categories</h2>
          <p>Early MVP surfaces will use these seeded categories.</p>
        </div>
        <div className="category-grid">
          {categories.map((category) => (
            <a href={`/search?category=${encodeURIComponent(category.toLowerCase())}`} key={category}>
              {category}
            </a>
          ))}
        </div>
      </section>
    </main>
  );
}
