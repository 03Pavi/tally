import type { Request, Response } from 'express';
import { TallyService } from './tally.service.js';
import type {
  ValidatedListFormsQuery,
  ValidatedFormIdParam,
  ValidatedSubmissionIdParam,
  ValidatedListSubmissionsQuery,
  ValidatedCurrentUserQuery,
} from './tally.validators.js';

export class TallyController {
  private readonly tallyService: TallyService;

  constructor(tallyService?: TallyService) {
    this.tallyService = tallyService ?? new TallyService();
  }

  public listForms = async (req: Request, res: Response): Promise<void> => {
    const query = req.query as unknown as ValidatedListFormsQuery;
    const forms = await this.tallyService.listForms(query);
    res.status(200).json({
      success: true,
      data: forms,
    });
  };

  public getForm = async (req: Request, res: Response): Promise<void> => {
    const { formId } = req.params as unknown as ValidatedFormIdParam;
    const form = await this.tallyService.getForm(formId);
    res.status(200).json({
      success: true,
      data: form,
    });
  };

  public listQuestions = async (req: Request, res: Response): Promise<void> => {
    const { formId } = req.params as unknown as ValidatedFormIdParam;
    const questions = await this.tallyService.listQuestions(formId);
    res.status(200).json({
      success: true,
      data: questions,
    });
  };

  public listSubmissions = async (req: Request, res: Response): Promise<void> => {
    const { formId } = req.params as unknown as ValidatedFormIdParam;
    const query = req.query as unknown as ValidatedListSubmissionsQuery;
    const submissions = await this.tallyService.listSubmissions(formId, query);
    res.status(200).json({
      success: true,
      data: submissions,
    });
  };

  public getSubmission = async (req: Request, res: Response): Promise<void> => {
    const { formId, submissionId } = req.params as unknown as ValidatedSubmissionIdParam;
    const submission = await this.tallyService.getSubmission(formId, submissionId);
    res.status(200).json({
      success: true,
      data: submission,
    });
  };

  public getCurrentUser = async (req: Request, res: Response): Promise<void> => {
    const query = req.query as unknown as ValidatedCurrentUserQuery;
    const user = await this.tallyService.getCurrentUser(query);
    res.status(200).json({
      success: true,
      data: user,
    });
  };
}
