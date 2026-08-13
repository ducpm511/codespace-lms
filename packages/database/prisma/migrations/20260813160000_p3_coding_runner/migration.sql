-- CreateEnum
CREATE TYPE "CodingLanguage" AS ENUM ('python');

-- CreateEnum
CREATE TYPE "CodingDifficulty" AS ENUM ('easy', 'medium', 'hard');

-- CreateEnum
CREATE TYPE "TestCaseKind" AS ENUM ('sample', 'hidden');

-- CreateEnum
CREATE TYPE "CodingSubmissionStatus" AS ENUM ('queued', 'running', 'passed', 'failed', 'error');

-- CreateEnum
CREATE TYPE "TestCaseResultStatus" AS ENUM ('passed', 'failed', 'tle', 'mle', 're', 'ce');

-- CreateTable
CREATE TABLE "coding_problems" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "lessonId" TEXT,
    "title" TEXT NOT NULL,
    "statementMd" TEXT NOT NULL,
    "language" "CodingLanguage" NOT NULL DEFAULT 'python',
    "starterCode" TEXT,
    "solutionCode" TEXT,
    "timeLimitMs" INTEGER NOT NULL DEFAULT 2000,
    "memoryLimitMb" INTEGER NOT NULL DEFAULT 128,
    "difficulty" "CodingDifficulty" NOT NULL DEFAULT 'easy',
    "maxScore" DECIMAL(6,2) NOT NULL DEFAULT 100,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "coding_problems_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "test_cases" (
    "id" TEXT NOT NULL,
    "problemId" TEXT NOT NULL,
    "name" TEXT,
    "stdin" TEXT NOT NULL,
    "expectedStdout" TEXT NOT NULL,
    "kind" "TestCaseKind" NOT NULL DEFAULT 'sample',
    "weight" DECIMAL(6,2) NOT NULL DEFAULT 1,
    "order" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "test_cases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coding_submissions" (
    "id" TEXT NOT NULL,
    "problemId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "classId" TEXT,
    "sourceCode" TEXT NOT NULL,
    "language" "CodingLanguage" NOT NULL DEFAULT 'python',
    "status" "CodingSubmissionStatus" NOT NULL DEFAULT 'queued',
    "score" DECIMAL(6,2),
    "runtimeMs" INTEGER,
    "memoryKb" INTEGER,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "coding_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "test_case_results" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "testCaseId" TEXT NOT NULL,
    "status" "TestCaseResultStatus" NOT NULL,
    "actualStdout" TEXT,
    "runtimeMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "test_case_results_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "coding_problems_courseId_idx" ON "coding_problems"("courseId");

-- CreateIndex
CREATE INDEX "coding_problems_lessonId_idx" ON "coding_problems"("lessonId");

-- CreateIndex
CREATE INDEX "coding_problems_createdById_idx" ON "coding_problems"("createdById");

-- CreateIndex
CREATE INDEX "test_cases_problemId_kind_idx" ON "test_cases"("problemId", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "test_cases_problemId_order_key" ON "test_cases"("problemId", "order");

-- CreateIndex
CREATE INDEX "coding_submissions_problemId_userId_classId_idx" ON "coding_submissions"("problemId", "userId", "classId");

-- CreateIndex
CREATE INDEX "coding_submissions_classId_idx" ON "coding_submissions"("classId");

-- CreateIndex
CREATE INDEX "coding_submissions_status_idx" ON "coding_submissions"("status");

-- CreateIndex
CREATE INDEX "test_case_results_testCaseId_idx" ON "test_case_results"("testCaseId");

-- CreateIndex
CREATE UNIQUE INDEX "test_case_results_submissionId_testCaseId_key" ON "test_case_results"("submissionId", "testCaseId");

-- AddForeignKey
ALTER TABLE "coding_problems" ADD CONSTRAINT "coding_problems_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coding_problems" ADD CONSTRAINT "coding_problems_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "lessons"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coding_problems" ADD CONSTRAINT "coding_problems_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_cases" ADD CONSTRAINT "test_cases_problemId_fkey" FOREIGN KEY ("problemId") REFERENCES "coding_problems"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coding_submissions" ADD CONSTRAINT "coding_submissions_problemId_fkey" FOREIGN KEY ("problemId") REFERENCES "coding_problems"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coding_submissions" ADD CONSTRAINT "coding_submissions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coding_submissions" ADD CONSTRAINT "coding_submissions_classId_fkey" FOREIGN KEY ("classId") REFERENCES "classes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_case_results" ADD CONSTRAINT "test_case_results_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "coding_submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_case_results" ADD CONSTRAINT "test_case_results_testCaseId_fkey" FOREIGN KEY ("testCaseId") REFERENCES "test_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;