const {test,expect}=require('@playwright/test');
const job={id:'d2a545e5-68b9-45f0-9ac9-bdcc841f0009',reference:'AEJ-TEST',title:'Operation Intern',title_dari:'کار آموز بخش عملیاتی',department:'Operations',employment_type:'internship',location:'Herat',work_mode:'on_site',summary:'Support local operations.',application_deadline:'2026-12-01T23:59:59Z'};
test('careers loads vacancies with the shared header and submits the selected role',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/api/trpc/operations.publicCareerPositions*',r=>r.fulfill({json:{result:{data:{json:[job]}}}}));
 let submitted;await page.route('**/api/trpc/operations.applyCareer',async r=>{submitted=r.request().postDataJSON().json;await r.fulfill({json:{result:{data:{json:{reference:'AEA-TEST'}}}}})});
 await page.goto('/careers');await expect(page.locator('#career-count')).toHaveText('1 open role');
 await page.getByRole('button',{name:'Apply for this role',exact:true}).click();
 await page.locator('[name=fullName]').fill('Test Applicant');await page.locator('[name=phone]').fill('+93700000000');await page.locator('[name=coverNote]').fill('I would like to support restaurant operations in Herat.');
 await page.locator('#career-submit').click();await expect(page.locator('#career-form-message')).toContainText('AEA-TEST');expect(submitted.positionId).toBe(job.id);expect(errors).toEqual([]);
});
test('careers language uses the shared preference and header toggle without crashing',async({page})=>{
 await page.addInitScript(()=>localStorage.setItem('ae_lang','fa'));
 await page.route('**/api/trpc/operations.publicCareerPositions*',r=>r.fulfill({json:{result:{data:{json:[job]}}}}));
 await page.goto('/careers');await expect(page.locator('.career-job-card h3')).toHaveText(job.title_dari);await expect(page.locator('body')).toHaveClass(/rtl/);
 await page.locator('.actions .lang').click();await expect(page.locator('.career-job-card h3')).toHaveText(job.title);await expect(page.locator('html')).toHaveAttribute('lang','en');
});
test('careers can retry a failed request instead of staying on loading',async({page})=>{
 let calls=0;await page.route('**/api/trpc/operations.publicCareerPositions*',r=>++calls===1?r.fulfill({status:503,json:{error:{message:'Temporarily unavailable'}}}):r.fulfill({json:{result:{data:{json:[job]}}}}));
 await page.goto('/careers');await expect(page.locator('#career-jobs')).toContainText('Openings are temporarily unavailable.');await page.locator('#career-retry').click();await expect(page.locator('#career-count')).toHaveText('1 open role');
});
