'use client';

import { FormEvent, useEffect, useState } from 'react';
import { adminGet, adminSend, CategoryRow } from '../../lib/adminApi';

export function CategoriesClient() {
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [status, setStatus] = useState('');

  async function load() {
    const result = await adminGet<CategoryRow[]>('/api/admin/platform/categories');
    setCategories(result);
  }

  useEffect(() => {
    load().catch(() => setStatus('Could not load categories.'));
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setStatus('Creating category...');
    try {
      await adminSend('/api/admin/platform/categories', 'POST', {
        name: form.get('name'),
        slug: form.get('slug'),
      });
      event.currentTarget.reset();
      await load();
      setStatus('');
    } catch {
      setStatus('Could not create category.');
    }
  }

  return (
    <>
      <div className="admin-heading"><h1>Categories</h1></div>
      <form className="admin-form-row" onSubmit={submit}>
        <input name="name" placeholder="Category name" required />
        <input name="slug" placeholder="category-slug" required />
        <button type="submit">Create</button>
      </form>
      {status && <p className="notice">{status}</p>}
      <div className="admin-table">
        {categories.map((category) => (
          <div className="admin-row" key={category.id}>
            <span>{category.name}<small>{category.slug}</small></span>
            <span className="badge">{category.isActive ? 'active' : 'inactive'}</span>
            <span>{category._count.tenants} tenants</span>
          </div>
        ))}
      </div>
    </>
  );
}
