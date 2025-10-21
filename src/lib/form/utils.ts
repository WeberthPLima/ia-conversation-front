export const validateCpf = (value: string) => {
  const cpf = value.replace(/\D/g, '');

  if (cpf.length !== 11 || /^(.)\1+$/.test(cpf)) {
    return false;
  }

  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(cpf.charAt(i)) * (10 - i);
  }

  let rest = 11 - (sum % 11);
  if (rest === 10 || rest === 11) {
    rest = 0;
  }

  if (rest !== parseInt(cpf.charAt(9))) {
    return false;
  }

  sum = 0;
  for (let j = 0; j < 10; j++) {
    sum += parseInt(cpf.charAt(j)) * (11 - j);
  }

  rest = 11 - (sum % 11);
  if (rest === 10 || rest === 11) {
    rest = 0;
  }

  if (rest !== parseInt(cpf.charAt(10))) {
    return false;
  }
  return true;
};

export const validatePhone = (value: string) => {
  const phone = value.replace(/\D/g, '');

  return phone.length === 11;
};

export const getCPFMask = (rawCpf: string): string => {
  const cleanedCpf = rawCpf.replace(/\D/g, '');

  let maskedCpf = cleanedCpf;
  if (cleanedCpf.length > 3) {
    maskedCpf = `${cleanedCpf.slice(0, 3)}.${cleanedCpf.slice(3)}`;
  }
  if (cleanedCpf.length > 6) {
    maskedCpf = `${maskedCpf.slice(0, 7)}.${maskedCpf.slice(7)}`;
  }
  if (cleanedCpf.length > 9) {
    maskedCpf = `${maskedCpf.slice(0, 11)}-${maskedCpf.slice(11)}`;
  }

  return maskedCpf;
};

export const getPhoneMask = (rawPhone: string): string => {
  const cleanedPhone = rawPhone.replace(/\D/g, '');

  let maskedPhone = cleanedPhone;
  if (cleanedPhone.length > 2) {
    maskedPhone = `(${cleanedPhone.slice(0, 2)}) ${cleanedPhone.slice(2)}`;
  }
  if (cleanedPhone.length > 7) {
    maskedPhone = `${maskedPhone.slice(0, 10)}-${maskedPhone.slice(10)}`;
  }

  return maskedPhone;
};

export const capitalizeFirstLetter = (text: string) => {
  text = text.trim();
  return text.charAt(0).toUpperCase() + text.slice(1);
};

export const capitalizeWords = (sentence: string) =>
  sentence
    .replace(/ /g, '')
    .split(/(?=[A-Z ])/)
    .map(word => capitalizeFirstLetter(word.trim()))
    .join(' ');
