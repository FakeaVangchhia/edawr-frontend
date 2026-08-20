import { HomePage } from './HomePage';

/**
 * The storefront home.
 *
 * A server component wrapping a client one, purely so the page's metadata is
 * static: everything below the fold depends on the customer's basket and saved
 * address, which only exist in the browser.
 */
export default function Page() {
  return <HomePage />;
}
