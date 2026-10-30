import {loadIndex,searchIndex} from '../lib/index.js';
import {CliError} from '../lib/errors.js';

export async function explainCourse(query,{term}={}){
  const index=await loadIndex('catalog');
  if(term&&term!==index.term)throw new CliError('NOT_INDEXED','This term is not indexed; another term is not substituted.');
  const results=searchIndex(index.records,query,5);
  return{query,term:term??index.term,termSelection:term?'explicit':'bundled-index-only',retrieval:'local-curated-index',liveChecked:false,
    coverage:index.coverage,verifiedAt:index.verifiedAt,results,
    evaluation:{studentReviewsAvailable:false,difficultyVerified:false,gradingDistributionAvailable:false,
      guidance:'只能根据官方课程内容、学分及先修要求说明课程定位；没有学生评价、给分或实际工作量证据。先修要求不等于已核实个人选课资格。'},
    ...(!results.length?{message:'当前目录未收录该课程；请到官方课程目录搜索，不表示没有开课。',entryUrl:'https://pcc.hkust-gz.edu.cn/undergraduate/program-course-catalog?tab=course-catalog'}:{})};
}
