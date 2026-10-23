using UnityEngine;
using UnityEngine.UI;
using Galaxy.Hangar.Data;

namespace Galaxy.Hangar.UI
{
    public class DockPanel : MonoBehaviour
    {
        [Header("Dock")]
        public Transform shipsContainer;
        public GameObject shipCardPrefab;

        public void Refresh()
        {
            foreach (Transform child in shipsContainer) Destroy(child.gameObject);

            foreach (var ship in Store.userShips)
            {
                var card = Instantiate(shipCardPrefab, shipsContainer);
                var shipComp = card.GetComponent<ShipCard>();
                shipComp.Setup(ship, Store.catalog);
            }
        }
    }
}
