using System;
using System.Collections.Generic;
using UnityEngine;
using Galaxy.Hangar.Data;

namespace Galaxy.Hangar.Economy
{
    public static class BuyService
    {
        public static bool TryBuy(string itemId, out string error)
        {
            error = null;
            if (Store.activeShip == null)
            {
                error = "Нет выбранного корабля";
                return false;
            }

            var item = Store.catalog.GetById(itemId);
            if (item == null)
            {
                error = "Товар не найден";
                return false;
            }

            var totalPrice = item.priceBuy;
            if (Store.Credits < totalPrice)
            {
                error = $"Недостаточно кредитов (нужно {totalPrice})";
                return false;
            }

            if (item.isShip)
            {
                error = "Корабли покупаются отдельно";
                return false;
            }

            if (item.slotId != null)
            {
                if (!TryEquipInSlot(item, out error))
                    return false;
            }
            else
            {
                if (!TryPlaceInHold(item, out error))
                    return false;
            }

            Store.activeShip.credits -= totalPrice;
            Store.Save();
            return true;
        }

        private static bool TryEquipInSlot(CatalogSO.Entry item, out string error)
        {
            error = null;
            foreach (var slot in Store.activeShip.slots)
            {
                if (slot.slotId == item.slotId && string.IsNullOrEmpty(slot.contentsId))
                {
                    slot.contentsId = item.id;
                    return true;
                }
            }

            foreach (var hold in Store.activeShip.holds)
            {
                if (CanFitInHold(hold, item))
                {
                    hold.contents.Add(item.id);
                    return true;
                }
            }

            error = "Нет свободного крепления и места в трюме";
            return false;
        }

        private static bool TryPlaceInHold(CatalogSO.Entry item, out string error)
        {
            error = null;
            foreach (var hold in Store.activeShip.holds)
            {
                if (CanFitInHold(hold, item))
                {
                    hold.contents.Add(item.id);
                    return true;
                }
            }

            error = "Нет свободного места в трюме";
            return false;
        }

        private static bool CanFitInHold(HoldEntry hold, CatalogSO.Entry item)
        {
            var currentMass = 0;
            foreach (var id in hold.contents)
            {
                var entry = Store.catalog.GetById(id);
                if (entry != null) currentMass += entry.mass;
            }
            return currentMass + item.mass <= hold.capacity;
        }
    }
}
