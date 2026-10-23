using System;

namespace Galaxy.Hangar.State
{
    public static class AppState
    {
        public enum Tab
        {
            Shop,
            ShipView,
            Info
        }

        public enum Category
        {
            All,
            Equipment,
            Resources,
            Ships
        }

        public static Tab currentTab = Tab.Shop;
        public static Category currentCategory = Category.All;
        public static string selectedSubcategory = null;

        public static void SetTab(Tab tab)
        {
            currentTab = tab;
        }

        public static void SetCategory(Category cat)
        {
            currentCategory = cat;
            selectedSubcategory = null;
        }

        public static void SetSubcategory(string subcat)
        {
            selectedSubcategory = subcat;
        }
    }
}
