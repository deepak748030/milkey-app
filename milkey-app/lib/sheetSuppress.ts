let suppressCollection = false;
let suppressSelling = false;

export const setSuppressCollection = (v: boolean) => { suppressCollection = v; };
export const setSuppressSelling = (v: boolean) => { suppressSelling = v; };
export const consumeSuppressCollection = () => {
  if (suppressCollection) { suppressCollection = false; return true; }
  return false;
};
export const consumeSuppressSelling = () => {
  if (suppressSelling) { suppressSelling = false; return true; }
  return false;
};
