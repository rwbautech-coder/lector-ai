export const detectLanguage = (text: string): 'pl' | 'en' | 'unknown' => {
  const sample = text.slice(0, 1000).toLowerCase();
  
  // Polish characteristic characters
  const polishChars = /[ąęśżźćńół]/;
  if (polishChars.test(sample)) return 'pl';

  // English stop words frequency check
  const englishWords = [' the ', ' and ', ' is ', ' in ', ' to ', ' of ', ' that '];
  let engCount = 0;
  englishWords.forEach(word => {
    if (sample.includes(word)) engCount++;
  });

  if (engCount >= 2) return 'en';

  return 'unknown';
};
