import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
for(const view of ["manager","builder","capture","history"]) test(`${view}: WCAG checks and keyboard navigation`,async({page})=>{
 await page.goto("/");
 await page.getByRole("button",{name:view,exact:true}).click();
 const results=await new AxeBuilder({page}).withTags(["wcag2a","wcag2aa","wcag21aa","wcag22aa"]).analyze();
 expect(results.violations).toEqual([]);
 const visited:string[]=[];
 for(let index=0;index<8;index++){
  await page.keyboard.press("Tab");
  visited.push(await page.evaluate(()=>{
   const focused=document.activeElement as HTMLElement | null;
   if(!focused)return "";
   return `${focused.getAttribute("role")??focused.tagName.toLowerCase()}:${focused.getAttribute("aria-label")??focused.textContent?.trim()??""}`;
  }));
 }
 expect(visited.some(item=>item.length>0)).toBe(true);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("history view remains keyboard operable at narrow widths",async({page})=>{
 await page.goto("/");
 await page.getByRole("button",{name:"history",exact:true}).click();
 await page.keyboard.press("Tab");
 await page.keyboard.press("Enter");
 await expect(page.getByText("Example")).toBeVisible();
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
