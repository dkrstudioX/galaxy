using UnityEngine;
using Galaxy.Hangar.Data;

namespace Galaxy.Hangar
{
    public class DataManager : MonoBehaviour
    {
        public CatalogSO catalogSO;
        public CategorySO[] categorySOs;

        private void Awake()
        {
            if (catalogSO == null || categorySOs == null || categorySOs.Length == 0)
            {
                Debug.LogWarning("[DataManager] CatalogSO или CategorySO не назначены! Назначьте в Inspector.");
            }

            Store.Initialize(catalogSO, categorySOs);
        }

        private void OnApplicationQuit()
        {
            Store.Save();
        }
    }
}
