/**
 * Start: what needs doing today.
 *
 * This used to be two buttons — edit a product, add a product — and four
 * catalogue counts. That was the whole admin once. It is not any more: an
 * order can be unpaid and holding a saree, a return can be waiting for a
 * reply, a parcel can have been out a fortnight, and until now none of that
 * was visible anywhere but the page it lives on.
 *
 * So the first thing here is the list of what is waiting, ranked, each line
 * linking to where it is dealt with. The product shortcuts stay underneath,
 * because they are still what the owner reaches for most.
 *
 * Every read is under the signed-in person's own session, so an editor who
 * cannot see orders simply gets no order lines — row-level security decides,
 * not this page. A read that fails is treated as "nothing to report" rather
 * than an error page, because a Start page that will not start is the worst
 * kind.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, CheckCircle2, PackagePlus, PencilLine, Tags } from 'lucide-react';
import {
  attentionItems,
  fetchCoupons,
  fetchOpenReturns,
  fetchOrders,
  getAllProducts,
  getInventoryRows,
  getJournalPosts,
  type Attention,
} from '@mridul/database';
import { currentAdmin, sessionClient } from '@mridul/supabase/server';
import { PageHead, Pill } from '../components/ui';

export const metadata: Metadata = { title: 'Start | Mridul Admin' };

/** A failed read is an empty list, never a broken page. */
async function quiet<T>(promise: Promise<T>, fallback: T): Promise<T> {
  try {
    return await promise;
  } catch {
    return fallback;
  }
}

export default async function Dashboard() {
  const db = await sessionClient();
  const admin = await currentAdmin();

  const [orders, returns, stock, posts, coupons, products] = await Promise.all([
    quiet(fetchOrders(db, { limit: 500 }), []),
    quiet(fetchOpenReturns(db), []),
    quiet(getInventoryRows(db), []),
    quiet(getJournalPosts(true, db), []),
    quiet(fetchCoupons(db), []),
    quiet(getAllProducts(db), []),
  ]);

  const items = attentionItems({ orders, returns, stock, posts, coupons, products });
  const urgent = items.filter((item) => item.tone === 'urgent').length;

  const hidden = products.filter((product) => !product.isActive).length;
  const outOfStock = products.filter((product) => product.stockTotal === 0).length;

  return (
    <>
      <PageHead
        title={
          urgent > 0
            ? `${urgent} ${urgent === 1 ? 'thing needs' : 'things need'} you today`
            : items.length > 0
              ? 'Nothing urgent'
              : 'All quiet'
        }
        subtitle={
          admin?.email
            ? `Signed in as ${admin.email}. Everything below links to where it is dealt with.`
            : 'Everything below links to where it is dealt with.'
        }
      />

      {items.length === 0 ? (
        <p className="attention-clear">
          <CheckCircle2 aria-hidden="true" />
          Nothing is waiting on you. No unpaid orders, nothing to pack, no returns to answer.
        </p>
      ) : (
        <ul className="attention-list" aria-label="What needs attention">
          {items.map((item: Attention) => (
            <li className={`attention-item is-${item.tone}`} key={item.key}>
              <Link href={item.href}>
                <span className="attention-count" aria-hidden="true">
                  {item.count}
                </span>
                <span className="attention-body">
                  <strong>{item.title}</strong>
                  <small>{item.detail}</small>
                </span>
                <ArrowRight aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      )}

      <div className="admin-choice-grid">
        <Link className="admin-choice" href="/products#existing-products">
          <span className="admin-choice-icon">
            <PencilLine aria-hidden="true" />
          </span>
          <span>
            <small>Products</small>
            <strong>Edit existing products</strong>
            <span>Change photos, details, price, category, stock, or storefront visibility.</span>
          </span>
          <ArrowRight aria-hidden="true" />
        </Link>

        <Link className="admin-choice is-accent" href="/products#add-product">
          <span className="admin-choice-icon">
            <PackagePlus aria-hidden="true" />
          </span>
          <span>
            <small>Products</small>
            <strong>Add a new product</strong>
            <span>Create a safe hidden draft, then add every detail before publishing it.</span>
          </span>
          <ArrowRight aria-hidden="true" />
        </Link>
      </div>

      <section className="admin-summary" aria-label="Catalogue summary">
        <div>
          <strong>{products.length}</strong>
          <span>Total products</span>
        </div>
        <div>
          <strong>{products.length - hidden}</strong>
          <span>Live on website</span>
        </div>
        <div>
          <strong>{hidden}</strong>
          <span>Hidden but saved</span>
        </div>
        <div>
          <strong>{outOfStock}</strong>
          <span>Out of stock</span>
        </div>
      </section>

      <div className="admin-safe-note">
        <Pill tone="muted">Safe archive</Pill>
        <p>
          “Hide from website” only removes a product from the customer-facing store. It remains
          here, faded, and can be edited or restored whenever stock returns.
        </p>
      </div>

      <Link className="admin-secondary-link" href="/categories">
        <Tags aria-hidden="true" /> Manage categories and their images
        <ArrowRight aria-hidden="true" />
      </Link>
    </>
  );
}
