using System;
using System.Linq;
using UnityEngine;
using Galaxy.Hangar.Data;

namespace Galaxy.Hangar.Economy
{
    public static class SellService
    {
        public static bool TrySellSlot(int slotIndex, out string error)
        {
            error = null;
            if (Store.activeShip == null || slotIndex < 0 || slotIndex >= Store.activeShip.slots.Count)
            {
                error = "Неверный индекс слота";
                return false;
            }

            var slot = Store.activeShip.slots[slotIndex];
            if (string.IsNullOrEmpty(slot.contentsId))
            {
                error = "Слот пуст";
                return false;
            }

            var item = Store.catalog.GetById(slot.contentsId);
            if (item == null)
            {
                error = "Товар не найден";
                return false;
            }

            if (item.priceSale <= 0)
            {
                error = "Цена продажи не задана";
                return false;
            }

            Store.activeShip.credits += item.priceSale;
            slot.contentsId = null;
            Store.Save();
            return true;
        }

        public static bool TrySellHold(int holdIndex, int contentIndex, out string error)
        {
            error = null;
            if (Store.activeShip == null || holdIndex < 0 || holdIndex >= Store.activeShip.holds.Count)
            {
                error = "Неверный индекс трюма";
                return false;
            }

            var hold = Store.activeShip.holds[holdIndex];
            if (contentIndex < 0 || contentIndex >= hold.contents.Count)
            {
                error = "Неверный индекс предмета";
                return false;
            }

            var itemId = hold.contents[contentIndex];
            var item = Store.catalog.GetById(itemId);
            if (item == null)
            {
                error = "Товар не найден";
                return false;
            }

            if (item.priceSale <= 0)
            {
                error = "Цена продажи не задана";
                return false;
            }

            Store.activeShip.credits += item.priceSale;
            hold.contents.RemoveAt(contentIndex);
            Store.Save();
            return true;
        }
    }
}
