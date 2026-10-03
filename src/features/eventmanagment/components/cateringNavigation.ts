export const cateringNavigation = [
  { title: "Catering", links: [
    ["Order pipeline", "command"], ["New order", "sales?doc=inquiries&new=1"],
    ["Menus & packages", "command?view=packages"], ["Event calendar", "command?view=calendar"],
    ["Quotes & proposals", "sales?doc=quotations"], ["Staffing & logistics", "event"],
    ["Kitchen production", "kitchen"], ["Invoicing", "finance"], ["Customers", "sales?doc=customers"]
  ] },
  { title: "Butchery", links: [
    ["Cutting orders", "butchery"], ["Yield & carcass", "butchery?view=yield"],
    ["Stock by cut", "butchery?view=stock"], ["Labels & tracing", "butchery?view=labels"],
    ["Production plan", "butchery?view=production"], ["Waste & shrinkage", "butchery?view=waste"], ["Operations & templates", "butchery?view=setup"]
  ] }
];

export function isCateringNavigationActive(to:string,pathname:string,search:string){
 const [path,query=""]=to.split("?");
 const currentPath=pathname.replace(/\/$/,"");
 if(currentPath!==path && !(path.endsWith("/command")&&currentPath===path.slice(0,-8)))return false;
 const expected=new URLSearchParams(query),actual=new URLSearchParams(search);
 return ["view","doc","new"].every(key=>{
  const fallback=key==="doc"&&path.endsWith("/sales")?"inquiries":"";
  return (expected.get(key)||fallback)===(actual.get(key)||fallback);
 });
}
