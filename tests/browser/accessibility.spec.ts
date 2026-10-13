import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
for(const view of ["manager","builder","capture","history"]) test(`${view}: WCAG checks and keyboard navigation`,async({page})=>{
 await page.goto("/");
 await page.getByRole("button",{name:view,exact:true}).click();
 const results=await new AxeBuilder({page}).withTags(["wcag2a","wcag2aa","wcag21aa","wcag22aa"]).analyze();
 expect(results.violations).toEqual([]);
 await page.keyboard.press("Tab");
 await expect(page.locator(":focus")).toHaveCount(1);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
test("draft stays mounted through navigation and manual save returns to manager",async({page})=>{
 await page.goto("/");await page.getByRole("button",{name:"builder",exact:true}).click();
 await page.getByRole("textbox",{name:"Label",exact:true}).fill("Remember this edit");
 await page.getByRole("button",{name:"history",exact:true}).click();
 await page.getByRole("button",{name:"builder",exact:true}).click();
 await expect(page.getByRole("textbox",{name:"Label",exact:true})).toHaveValue("Remember this edit");
 await page.getByRole("button",{name:"Save draft",exact:true}).click();
 await expect(page.getByRole("heading",{name:"Forms",exact:true})).toBeVisible();
});
