"use client";
import { BillItemAdvanced, BillItemFields, BillItemPayer, BillItemSplit, BillItemTaxes } from "./BillItemSections";
import RestaurantPicker from "./RestaurantPicker";
import type { BillItemProps } from "./bill-item-types";
import styles from "./BillEditor.module.css";

export default function BillItemDesktop(props: BillItemProps) {
  const { item, index, itemPayersEnabled, restaurants, locked, saving, onUpdate } = props;
  return <div className={`editor-item ${styles.itemContainer}`}>
    <div className="item-index">{index + 1}</div>
    <BillItemFields {...props} showRemove />
    <div className={styles.allocationRow}><BillItemSplit {...props} /><BillItemTaxes {...props} /></div>
    {(itemPayersEnabled || restaurants.length > 0) && <div className={styles.itemMeta}>
      {itemPayersEnabled && <BillItemPayer {...props} />}
      {restaurants.length > 0 && <div className={styles.restaurantSlot}><RestaurantPicker restaurants={restaurants} value={item.restaurantId} index={index} disabled={locked || saving} onChange={restaurantId => onUpdate({ restaurantId })} /></div>}
    </div>}
    <BillItemAdvanced {...props} />
  </div>;
}
