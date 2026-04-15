import { Octokit } from "@octokit/rest";
import { config } from "./config.js";

const octokit = new Octokit({ auth: config.GITHUB_TOKEN });

export interface RepoRef { owner: string; repo: string; }

export function parseRepo(repoStr: string): RepoRef {
    const [owner, repo] = repoStr.split("/");
    if (!owner || !repo) throw new Error(`Invalid repo string: ${repoStr}`);
    return { owner, repo };
}

export async function createIssue(
    repoStr: string,
    title: string,
    body: string,
    labels: string[] = []
): Promise<{ number: number; html_url: string }> {
    const { owner, repo } = parseRepo(repoStr);
    const res = await octokit.issues.create({ owner, repo, title, body, labels });
    return { number: res.data.number, html_url: res.data.html_url };
}

export async function updateIssue(
    repoStr: string,
    issueNumber: number,
    fields: {
        title?: string;
        body?: string;
        state?: "open" | "closed";
        state_reason?: "completed" | "not_planned" | "reopened" | null;
    }
): Promise<void> {
    const { owner, repo } = parseRepo(repoStr);
    await octokit.issues.update({ owner, repo, issue_number: issueNumber, ...fields });
}

export async function addIssueComment(
    repoStr: string,
    issueNumber: number,
    body: string
): Promise<{ id: number; html_url: string }> {
    const { owner, repo } = parseRepo(repoStr);
    const res = await octokit.issues.createComment({ owner, repo, issue_number: issueNumber, body });
    return { id: res.data.id, html_url: res.data.html_url };
}

export interface IssueCommentView {
    id: number;
    body: string;
    html_url: string;
    user: string;
    userProfileUrl?: string;
    userAvatarUrl?: string;
    createdAt: string;
    updatedAt: string;
}

export interface IssueView {
    id: number;
    number: number;
    title: string;
    body: string;
    html_url: string;
    state: "open" | "closed";
    user: string;
    userProfileUrl?: string;
    userAvatarUrl?: string;
    labels: string[];
}

function mapIssue(issue: {
    id: number;
    number: number;
    title: string;
    body?: string | null;
    html_url: string;
    state: string;
    user?: { login?: string | null; html_url?: string | null; avatar_url?: string | null } | null;
    labels: Array<string | { name?: string | null }>;
}): IssueView {
    return {
        id: issue.id,
        number: issue.number,
        title: issue.title,
        body: issue.body ?? "",
        html_url: issue.html_url,
        state: issue.state === "closed" ? "closed" : "open",
        user: issue.user?.login ?? "unknown",
        userProfileUrl: issue.user?.html_url ?? undefined,
        userAvatarUrl: issue.user?.avatar_url ?? undefined,
        labels: issue.labels
            .map((label) => (typeof label === "string" ? label : (label.name ?? "")))
            .filter((name): name is string => Boolean(name)),
    };
}

export async function listRepoIssues(repoStr: string, state: "open" | "closed" | "all" = "open"): Promise<IssueView[]> {
    const { owner, repo } = parseRepo(repoStr);
    const issues = await octokit.paginate(octokit.issues.listForRepo, {
        owner,
        repo,
        state,
        per_page: 100,
    });

    return issues
        .filter((issue) => !("pull_request" in issue))
        .map((issue) => mapIssue(issue));
}

export async function getIssue(repoStr: string, issueNumber: number): Promise<IssueView> {
    const { owner, repo } = parseRepo(repoStr);
    const res = await octokit.issues.get({ owner, repo, issue_number: issueNumber });
    return mapIssue(res.data);
}

export async function listIssueComments(
    repoStr: string,
    issueNumber: number
): Promise<IssueCommentView[]> {
    const { owner, repo } = parseRepo(repoStr);
    const res = await octokit.paginate(octokit.issues.listComments, {
        owner,
        repo,
        issue_number: issueNumber,
        per_page: 100,
    });

    return res.map((comment) => ({
        id: comment.id,
        body: comment.body ?? "",
        html_url: comment.html_url,
        user: comment.user?.login ?? "unknown",
        userProfileUrl: comment.user?.html_url,
        userAvatarUrl: comment.user?.avatar_url,
        createdAt: comment.created_at,
        updatedAt: comment.updated_at,
    }));
}

export async function updateIssueComment(
    repoStr: string,
    commentId: number,
    body: string
): Promise<void> {
    const { owner, repo } = parseRepo(repoStr);
    await octokit.issues.updateComment({ owner, repo, comment_id: commentId, body });
}
