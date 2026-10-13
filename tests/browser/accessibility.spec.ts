import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
const assertViewActive = async (page: import("@playwright/test").Page, view: string): Promise<void> => {
 if (view === "manager") {
  await expect(page.getByRole("heading",{name:"Forms",exact:true})).toBeVisible();
  return;
 }
 if (view === "builder") {
  await expect(page.getByRole("heading",{name:"Builder",exact:true})).toBeVisible();
  return;
 }
 if (view === "capture") {
  await expect(page.getByRole("button",{name:"Submit",exact:true})).toBeVisible();
  return;
 }
 await expect(page.getByRole("heading",{name:"Revision history",exact:true})).toBeVisible();
};

for(const view of ["manager","builder","capture","history"]) test(`${view}: WCAG checks and keyboard navigation`,async({page})=>{
 await page.goto("/");
 const viewButton=page.getByRole("button",{name:view,exact:true});
 await viewButton.focus();
 await expect(viewButton).toBeFocused();
 await page.keyboard.press("Enter");
 await assertViewActive(page, view);
 const results=await new AxeBuilder({page}).withTags(["wcag2a","wcag2aa","wcag21aa","wcag22aa"]).analyze();
 expect(results.violations).toEqual([]);
 await page.keyboard.press("Tab");
 const focusedRole=await page.evaluate(()=>document.activeElement?.getAttribute("role") ?? document.activeElement?.tagName.toLowerCase() ?? "");
 expect(focusedRole.length).toBeGreaterThan(0);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("history view remains keyboard operable at narrow widths",async({page})=>{
 await page.goto("/");
 const historyButton=page.getByRole("button",{name:"history",exact:true});
 await historyButton.focus();
 await page.keyboard.press("Space");
 await expect(page.getByRole("heading",{name:"Revision history",exact:true})).toBeVisible();
 await page.keyboard.press("Tab");
 await page.keyboard.press("Enter");
 await expect(page.getByText("Example")).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("builder keyboard operations activate controls, restore focus from popup, and move fields",async({page})=>{
 await page.goto("/");
 const builderButton=page.getByRole("button",{name:"builder",exact:true});
 await builderButton.focus();
 await page.keyboard.press("Enter");
 await expect(page.getByRole("heading",{name:"Builder",exact:true})).toBeVisible();

 const addTextButton=page.locator('section[aria-label="Form builder"] aside').first().getByRole("button",{name:"Text",exact:true});
 await addTextButton.focus();
 await page.keyboard.press("Space");

 const layoutButtons=page.locator('section[aria-label="Form builder"] main button');
 await expect(layoutButtons).toHaveCount(2);
 await expect(layoutButtons.first()).toContainText("Name");

 const textFieldButton=page.locator('section[aria-label="Form builder"] main button').filter({hasText:"Text field"}).first();
 await textFieldButton.focus();
 await page.keyboard.press("Enter");
 await page.keyboard.press("Alt+ArrowUp");
 await expect(layoutButtons.first()).toContainText("Text field");

 const dataTab=page.getByRole("button",{name:"Data",exact:true});
 await dataTab.focus();
 await page.keyboard.press("Enter");
 const sourceSelect=page.getByRole("combobox",{name:"Source",exact:true});
 await sourceSelect.focus();
 await expect(sourceSelect).toBeFocused();
 await page.keyboard.press("Space");
 await expect(page.getByRole("listbox")).toBeVisible();
 await page.keyboard.press("Escape");
 await expect(sourceSelect).toBeFocused();
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
