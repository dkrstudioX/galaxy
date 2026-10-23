using System.Linq;
using Galaxy.Hangar.Data;

namespace Galaxy.Hangar.Economy
{
    public static class MassService
    {
        public static int GetShipMass()
        {
            if (Store.activeShip == null) return 0;

            var shipEntry = Store.catalog.GetById(Store.activeShip.shipId);
            var baseMass = shipEntry?.mass ?? 0;

            var equipmentMass = 0;
            foreach (var slot in Store.activeShip.slots)
            {
                if (!string.IsNullOrEmpty(slot.contentsId))
                {
                    var item = Store.catalog.GetById(slot.contentsId);
                    if (item != null) equipmentMass += item.mass;
                }
            }

            foreach (var hold in Store.activeShip.holds)
            {
                foreach (var itemId in hold.contents)
                {
                    var item = Store.catalog.GetById(itemId);
                    if (item != null) equipmentMass += item.mass;
                }
            }

            return baseMass + equipmentMass;
        }

        public static int GetHoldFreeSpace(int holdIndex)
        {
            if (Store.activeShip == null || holdIndex < 0 || holdIndex >= Store.activeShip.holds.Count)
                return 0;

            var hold = Store.activeShip.holds[holdIndex];
            var currentMass = 0;

            foreach (var itemId in hold.contents)
            {
                var item = Store.catalog.GetById(itemId);
                if (item != null) currentMass += item.mass;
            }

            return hold.capacity - currentMass;
        }
    }
}
