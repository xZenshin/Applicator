import {
  ApplicationLetterSchema,
  CvContentSchema,
  DraftSchema,
  JobInfoSchema,
  ProfileSchema,
  StyleSchema,
  type ApplicationLetter,
  type CvContent,
  type Draft,
  type JobInfo,
  type Profile,
  type Style
} from '../../src/shared/types'

/** 12 words × 10 = exactly 120 words. */
export const SAMPLE_120_WORDS = Array(10)
  .fill('I am excited to apply for this role at your company today.')
  .join(' ')

export function sampleProfile(): Profile {
  return ProfileSchema.parse({
    version: 1,
    personal: {
      fullName: 'Jane Doe',
      email: 'jane@example.com',
      phone: '+45 12 34 56 78',
      location: 'Copenhagen, Denmark',
      links: [{ label: 'LinkedIn', url: 'https://linkedin.com/in/janedoe' }]
    },
    summary: 'Data engineer with five years of experience building data pipelines.',
    experience: [
      {
        id: 'exp_01',
        title: 'Data Engineer',
        employer: 'Ørsted A/S',
        location: 'Copenhagen',
        start: '2021-03',
        end: 'present',
        bullets: ['Built batch and streaming pipelines in Python', 'Cut warehouse costs by 30%']
      },
      {
        id: 'exp_02',
        title: 'Junior Developer',
        employer: 'Contoso ApS',
        location: 'Aarhus',
        start: '2018-08',
        end: '2021-02',
        bullets: ['Maintained internal web tools']
      }
    ],
    education: [
      {
        id: 'edu_01',
        degree: 'MSc Computer Science',
        institution: 'DTU',
        location: 'Lyngby',
        start: '2016-09',
        end: '2018-06',
        details: ['Thesis on stream processing']
      }
    ],
    skills: [
      { id: 'skill_01', name: 'Python', category: 'Programming' },
      { id: 'skill_02', name: 'SQL', category: 'Programming' }
    ],
    nextIds: {
      skills: 3,
      education: 2,
      experience: 3
    }
  })
}

export function sampleStyle(): Style {
  return StyleSchema.parse({
    version: 1,
    samples: [
      { id: 's1', title: 'Application to Contoso', text: SAMPLE_120_WORDS, active: true },
      {
        id: 's2',
        title: 'Old application',
        text: 'INACTIVE-MARKER this one should not be used.',
        active: false
      }
    ],
    defaultInstructions: 'Keep it under one page.'
  })
}

export function sampleJob(): JobInfo {
  return JobInfoSchema.parse({
    company: 'Acme',
    role: 'Data Engineer',
    language: 'en',
    keyRequirements: ['Python', 'SQL']
  })
}

export function sampleCv(): CvContent {
  return CvContentSchema.parse({
    summary: 'Data engineer with five years of experience building reliable pipelines.',
    experience: [
      { id: 'exp_01', title: 'Data Engineer', bullets: ['Built batch and streaming pipelines in Python'] }
    ],
    education: [{ id: 'edu_01', degree: 'MSc Computer Science', details: [] }],
    skills: [{ id: 'skill_01', name: 'Python', category: 'Programming' }],
    labels: {
      skills: 'Technical Skills',
      education: 'Education',
      experience: 'Experience',
      present: 'Present'
    }
  })
}

export function sampleLetter(): ApplicationLetter {
  return ApplicationLetterSchema.parse({
    greeting: 'Dear Hiring Manager,',
    paragraphs: [
      'I am applying for the Data Engineer position at Acme.',
      'At Ørsted I built batch and streaming pipelines in Python.',
      'I would welcome the chance to discuss how I can help your team.'
    ],
    signOff: 'Kind regards,'
  })
}

export function sampleDraft(): Draft {
  return DraftSchema.parse({
    version: 1,
    instructions: '',
    job: sampleJob(),
    cv: sampleCv(),
    letter: sampleLetter(),
    untranslatedIds: [],
    warnings: []
  })
}
