import { Router } from 'express';
import { jobsRouter } from './jobs.js';
import { jobQuestionMappingsRouter, questionMappingsRouter } from './questionMappings.js';
import { jobCriteriaRouter, criteriaRouter } from './jobCriteria.js';
import { jobCandidatesRouter, candidatesRouter } from './candidates.js';
import { runsRouter } from './runs.js';

export const apiRouter = Router();

apiRouter.use('/jobs/:jobId/question-mappings', jobQuestionMappingsRouter);
apiRouter.use('/jobs/:jobId/criteria', jobCriteriaRouter);
apiRouter.use('/jobs/:jobId/candidates', jobCandidatesRouter);
apiRouter.use('/jobs', jobsRouter);
apiRouter.use('/question-mappings', questionMappingsRouter);
apiRouter.use('/criteria', criteriaRouter);
apiRouter.use('/candidates', candidatesRouter);
apiRouter.use('/runs', runsRouter);
