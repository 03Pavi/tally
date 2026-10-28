import type { Request, Response } from 'express';
import { FormsService } from './forms.service.js';
import type {
  ValidatedListFormsQuery,
  ValidatedFormIdParam,
  ValidatedSubmissionIdParam,
  ValidatedCreateFormBody,
  ValidatedUpdateFormBody,
  ValidatedListSubmissionsQuery,
} from './forms.validators.js';

export class FormsController {
  private readonly formsService: FormsService;

  constructor(formsService?: FormsService) {
    this.formsService = formsService ?? new FormsService();
  }

  public listForms = async (req: Request, res: Response): Promise<void> => {
    const query = req.query as unknown as ValidatedListFormsQuery;
    const forms = await this.formsService.listForms(query);
    res.status(200).json({ success: true, data: forms });
  };

  public createForm = async (req: Request, res: Response): Promise<void> => {
    const body = req.body as ValidatedCreateFormBody;
    const form = await this.formsService.createForm(body);
    res.status(201).json({ success: true, data: form });
  };

  public getForm = async (req: Request, res: Response): Promise<void> => {
    const { formId } = req.params as unknown as ValidatedFormIdParam;
    const form = await this.formsService.getForm(formId);
    res.status(200).json({ success: true, data: form });
  };

  public updateForm = async (req: Request, res: Response): Promise<void> => {
    const { formId } = req.params as unknown as ValidatedFormIdParam;
    const body = req.body as ValidatedUpdateFormBody;
    const form = await this.formsService.updateForm(formId, body);
    res.status(200).json({ success: true, data: form });
  };

  public deleteForm = async (req: Request, res: Response): Promise<void> => {
    const { formId } = req.params as unknown as ValidatedFormIdParam;
    await this.formsService.deleteForm(formId);
    res.status(200).json({
      success: true,
      data: { message: 'Form deleted successfully' },
    });
  };

  public listQuestions = async (req: Request, res: Response): Promise<void> => {
    const { formId } = req.params as unknown as ValidatedFormIdParam;
    const questions = await this.formsService.listQuestions(formId);
    res.status(200).json({ success: true, data: questions });
  };

  public listSubmissions = async (req: Request, res: Response): Promise<void> => {
    const { formId } = req.params as unknown as ValidatedFormIdParam;
    const query = req.query as unknown as ValidatedListSubmissionsQuery;
    const submissions = await this.formsService.listSubmissions(formId, query);
    res.status(200).json({ success: true, data: submissions });
  };

  public getSubmission = async (req: Request, res: Response): Promise<void> => {
    const { formId, submissionId } = req.params as unknown as ValidatedSubmissionIdParam;
    const submission = await this.formsService.getSubmission(formId, submissionId);
    res.status(200).json({ success: true, data: submission });
  };

  public deleteSubmission = async (req: Request, res: Response): Promise<void> => {
    const { formId, submissionId } = req.params as unknown as ValidatedSubmissionIdParam;
    await this.formsService.deleteSubmission(formId, submissionId);
    res.status(200).json({
      success: true,
      data: { message: 'Submission deleted successfully' },
    });
  };
}
