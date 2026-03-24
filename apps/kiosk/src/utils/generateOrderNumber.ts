/**
 * Module-level counter that cycles from 1 to 999.
 */
let counter = 0;

/**
 * Generate the next order number, cycling from 1 through 999.
 */
export function generateOrderNumber(): number {
  counter = (counter % 999) + 1;
  return counter;
}
