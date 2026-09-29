import 'server-only';
import { pipelineCss } from '@/lib/pipelines/css';

/**
 * Links the pipeline-colour stylesheet (see /pipeline-styles.css). The version
 * changes whenever an admin edits a colour, so browsers fetch the new one.
 */
export async function PipelineStyles() {
  const { version } = await pipelineCss();
  return <link rel="stylesheet" href={`/pipeline-styles.css?v=${version}`} precedence="default" />;
}
