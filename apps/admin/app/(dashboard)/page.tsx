import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, PackagePlus, PencilLine, Tags } from "lucide-react";
import { getAllProducts } from "@mridul/database";
import { sessionClient } from "@mridul/supabase/server";
import { PageHead, Pill } from "../components/ui";

export const metadata: Metadata = { title: "Start | Mridul Admin" };

export default async function Dashboard() {
  const products = await getAllProducts(await sessionClient());
  const hidden = products.filter((product) => !product.isActive).length;
  const outOfStock = products.filter((product) => product.stockTotal === 0).length;

  return (
    <>
      <PageHead
        title="What would you like to do?"
        subtitle="Products are managed in one place. Nothing is permanently deleted."
      />

      <div className="admin-choice-grid">
        <Link className="admin-choice" href="/products#existing-products">
          <span className="admin-choice-icon">
            <PencilLine aria-hidden="true" />
          </span>
          <span>
            <small>Option 1</small>
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
            <small>Option 2</small>
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

