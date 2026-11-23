# Afghan Eats restaurant discovery — field map

**Review note:** The screenshot frames use named Playwright fixture data, not the live restaurant catalogue. This mapping describes the review implementation and the fields it is allowed to show. A quote requires a manual address entry; the default location label is not a delivery address or service-coverage check.

## Restaurant cards and listing

| Screen element | Source field / origin | Display rule in this review |
|---|---|---|
| Restaurant name | `restaurants.list`: `name`, `name_dari`; stable route via `id`, `slug`, or `public_slug` | Localize when Dari is available; retain natural direction for mixed-script names. Card opens the existing `/restaurant.html?id=…` menu route. |
| Cuisine and district | `cuisine_tags[]` or `category_primary`; `district` | Show only available catalogue values; cuisine chips use terms grounded in current menu/catalogue content. No unsupported dish category is inferred. |
| Cover image and logo | `cover_image_url`, then `gallery_images[]`; `logo_url` | Use safe media URL and resilient fallback with the same image-frame dimensions. Missing imagery is labeled as unavailable, not replaced with a guessed dish photo. |
| Open-now filter | `is_open` boolean | Show the filter only when the visible catalogue supplies a boolean for every row; do not infer current opening from a generic active status. |
| Verified-information filter/badge | `verification_status` (`owner_confirmed`, `field_verified`) | Show only for the supported verification states. Does not imply delivery coverage. |
| Customer rating and review count | `rating` plus `total_reviews`, passed through `trustedRating()` | Show only when both are positive; otherwise display “No verified customer rating.” Directory and unverified menu-preview rows are not given customer ratings. |
| Saved favourite | Existing local favourite state keyed by restaurant `id` | The heart toggles the user's saved state only; it is not a public review or popularity signal. |
| Result count | Visible restaurant rows after supported search, cuisine, fulfilment, and filter conditions | Count is a listing count, not a count of restaurants that quote delivery to a specific address. |

## Fulfilment, fees, and map

| Screen element | Source field / origin | Display rule in this review |
|---|---|---|
| Delivery time | Address-specific `orders.quote` response: `_deliveryQuote.etaMin`, `_deliveryQuote.etaMax` | Display only for a non-pickup quote matching delivery. If absent, show “Delivery time pending.” Never promote catalogue `delivery_time_min/max` to a confirmed customer estimate. |
| Delivery fee | Matching delivery quote: `_deliveryQuote.deliveryFee` | Display only when present in the matching quote; `0` is “Free delivery.” Otherwise show that the fee needs address confirmation. Raw `delivery_fee_min` is not treated as a confirmed quote. Format as `AFN` in English and `افغانی` in Dari. |
| Minimum order | Matching delivery quote: `_deliveryQuote.minimumOrder` | Display only when the address-specific delivery quote provides a positive amount. Raw `min_order_amount` is not shown as a confirmed checkout minimum. Format as `AFN` in English and `افغانی` in Dari. |
| Pickup preparation/collection time | Pickup quote: `pickupEtaMin/Max` or `collectionEtaMin/Max` | Display only when these dedicated pickup fields exist on a pickup quote. Otherwise show “Pickup timing not confirmed”; the app's copied delivery ETA is not reused. |
| Pickup fee / minimum | None in the browse card | Do not show a delivery fee in pickup mode. Pickup minimums are also omitted because the existing app can seed that value from raw `min_order_amount` rather than a confirmed pickup quote. Delivery-only fee and fastest sorting choices are hidden in pickup mode. |
| Delivery unavailable at the entered address | Fresh address-specific `orders.quote` failure tagged as unavailable; transient `_deliveryUnavailable` state | Clear the prior delivery quote before checking a changed address. Show unavailable only for a matching service-area/coverage response; a missing or transient quote remains unconfirmed. Public menus stay browsable. |
| Map coordinates | Existing map catalogue/research records with `location.accuracy === "verified"`, finite coordinates, and Herat-bounds validation | Only verified in-bounds locations can create map pins. Map preview uses the same mode-matched quote guards as the list. List view remains available when map configuration or loading fails. |

## Search, offers, and fields not yet supported

| Element | Source field / origin | Current handling |
|---|---|---|
| Dish results | Existing dish search endpoint plus dish name, Dari name, description, and restaurant association | Stale responses are ignored; selecting a result routes to its existing menu. |
| Delivery / pickup switch | Existing `mode` and restaurant eligibility (`has_delivery`, `has_takeaway`) | Remains usable for browsing while ordering is paused. It does not enable checkout or order actions. |
| Delivery-location control | Manual full street/area/landmark entered by the user and saved as `localStorage.ae_address` | The dialog clears cached and in-memory quotes, silently selects delivery mode, then calls `refreshDeliveryContext()` to invalidate any in-flight quote hydration for the previous address and run the existing `hydrateDeliveryContext()` flow on the currently loaded listing. That flow sends a read-only GET to `orders.quote` per orderable restaurant with delivery enabled; the exact input is `{ restaurantId, fulfillment, deliveryArea, deliveryAddress }`, with the entered string used for both area and address. No basket, subtotal, item or order data is sent. Only returned quote data updates fees/timing; a tagged coverage failure may mark the restaurant unavailable. No device geolocation or geocoding is used. Ordering remains paused. |
| Legacy browse-area value | Existing `localStorage.ae_browse_area` value from the earlier display-only control | Not used as an address or as proof of coverage. The new dialog requires an explicit manual address before requesting a quote. |
| Offers, sponsored placement, loyalty, dietary badges | No verified active campaign/placement or reliable partner-specific fields are wired into this listing | Omit rather than invent a promotion, sponsorship, diet claim, or loyalty benefit. Add only when an authoritative active data source exists. |
| Distance and 4+ rating sort | No complete, trustworthy per-customer distance or rating dataset in the current listing flow | Not offered as a sort option. A partial or unverified ordering would be misleading. |
| Sparse catalogue / outside-area state | Test fixtures only | Review frames are explicitly named `fixture`; values are illustrative and must not be mistaken for production availability. |

## Key source files

- `assets/restaurant-listing-review.js` — manual address dialog, quote refresh wiring, display guards, staged filters, and card metadata.
- `assets/restaurant-discovery-map.js` — map-coordinate validation and quote-aware previews.
- `assets/app.js` — existing catalogue, rating, fulfilment and menu-hand-off functions; not modified for this website-only review.
- `tests/customer-journey.spec.js` — fixture routes, assertions, and review-frame capture.
