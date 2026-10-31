type Restaurant = { id: string; name: string };
type RestaurantItem = { restaurantId: string | null };

export function groupReceiptItems<T extends RestaurantItem>(items: T[], restaurants: Restaurant[] | null) {
  const groups = (restaurants ?? []).map(restaurant => ({ key: `restaurant:${restaurant.id}`, name: restaurant.name, items: [] as T[] }));
  const byId = new Map((restaurants ?? []).map((restaurant, index) => [restaurant.id, groups[index]]));
  const unassigned = { key: "unassigned", name: null, items: [] as T[] };
  for (const item of items) (item.restaurantId && byId.get(item.restaurantId) || unassigned).items.push(item);
  return [...groups, unassigned].filter(group => group.items.length > 0);
}
