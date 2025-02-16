
export const getDomainFromWindow = () => {
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }

  return null;
};