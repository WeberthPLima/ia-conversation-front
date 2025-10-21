import { ALLOWED_ENVIRONMENTS } from './const';

export type ExperienceType = {
  id: string;
  hasStarted: boolean;
  data: {
    earn: string;
    earn_email: string;
    cell_phone: string;
    ddi: string;
    cpf?: string;
    lang_mail: string;
    birth_date: string;
    area: string;
    collection?: string;
  };
};

export type ExperienceData = ExperienceType['data'];

export type AllowedEnvironmentsType = (typeof ALLOWED_ENVIRONMENTS)[number];
