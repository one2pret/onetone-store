# Mobile API readiness — tahap 1

Branch: `feature/mobile-api-readiness`

## Scope
- Validate positive integer `productId` and `quantity` for POST /api/cart.
- Apply category filter in SQL before pagination and count for GET /api/products.
- Guard page/limit against NaN, Infinity, fractions and invalid values.

## Manual verification (staging only)
1. GET /api/products?category=<existing-slug>&page=1&limit=10: verify all items belong to category and meta.total matches category count.
2. GET /api/products?page=NaN&limit=Infinity: expect valid defaults.
3. POST /api/cart unauthenticated: expect 401.
4. With staging customer bearer token, POST /api/cart with quantity -1, 0, 1.5 or string: expect 400; quantity 1 should succeed with an active product.
5. Verify normal website cart still works, including any product variant selection.

## Before checkout launch (not fixed in this commit)
- Revalidate courier rate server-side; never trust client courierPrice.
- Make order, items, shipping, stock, cart mutations atomic and handle invoice creation failures safely.
- Add idempotency for order submission and concurrency-safe stock deduction.
- Review variant identity and quantity validation in all cart update endpoints.
- Run build, tests and staging checkout end-to-end before merging.

No production deployment or database migrations are included.
