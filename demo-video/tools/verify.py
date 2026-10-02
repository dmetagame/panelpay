import hashlib,json,subprocess
from pathlib import Path
from PIL import Image,ImageStat,ImageDraw
ROOT=Path(__file__).resolve().parents[1];video=ROOT/'panelpay-demo.mp4'
probe=json.loads(subprocess.check_output(['ffprobe','-v','error','-show_streams','-show_format','-of','json',str(video)],text=True))
v=next(s for s in probe['streams'] if s['codec_type']=='video');a=next(s for s in probe['streams'] if s['codec_type']=='audio')
assert (v['width'],v['height'],v['r_frame_rate'],v['codec_name'])==(1920,1080,'30/1','h264')
assert a['codec_name']=='aac';assert float(probe['format']['duration'])<180
subprocess.run(['ffmpeg','-v','error','-i',str(video),'-f','null','-'],check=True)
scenes=json.loads((ROOT/'src'/'timeline.json').read_text());folder=ROOT/'verification-frames';folder.mkdir(exist_ok=True)
offset=0;frames=[]
for scene in scenes:
 duration=scene['frames']/30
 assert scene['audioDuration']+11/30<duration
 assert max(c['end'] for c in scene['captions'])<duration
 for label,t in [('mid',offset+duration/2),('ending',offset+duration-.5)]:
  path=folder/f"{scene['id']}-{label}.jpg"
  subprocess.run(['ffmpeg','-v','error','-y','-ss',str(t),'-i',str(video),'-frames:v','1','-q:v','2',str(path)],check=True)
  im=Image.open(path);assert im.size==(1920,1080)
  assert max(ImageStat.Stat(im.crop((72,185,1848,910))).stddev)>5
  frames.append({'scene':scene['id'],'position':label,'seconds':round(t,3),'file':str(path.relative_to(ROOT))})
 offset+=duration
sheet=Image.new('RGB',(960,270*4),(241,245,244));draw=ImageDraw.Draw(sheet)
for i,record in enumerate(frames):
 im=Image.open(ROOT/record['file']);im.thumbnail((480,245));x=i%2*480;y=i//2*135
 # Four columns by four rows, keeping every sampled frame inspectable.
 x=i%4*240;y=i//4*270
 im=Image.open(ROOT/record['file']);im.thumbnail((240,240));sheet.paste(im,(x,y+24));draw.text((x+5,y+5),record['scene']+' / '+record['position'],fill=(24,61,71))
sheet.save(ROOT/'verification-contact.jpg',quality=90)
subprocess.run(['ffmpeg','-v','error','-y','-ss','5','-i',str(video),'-frames:v','1','-q:v','2',str(ROOT/'poster.jpg')],check=True)
result={'durationSeconds':float(probe['format']['duration']),'resolution':[1920,1080],'fps':30,'videoCodec':'h264','audioCodec':'aac','completeDecode':'PASS','audioCaptionBoundaries':'PASS','sceneEndChecks':'PASS','sha256':hashlib.sha256(video.read_bytes()).hexdigest(),'bytes':video.stat().st_size,'frames':frames,'downloadIntegrity':'pending upload'}
(ROOT/'verification.json').write_text(json.dumps(result,indent=2));print(json.dumps({k:v for k,v in result.items() if k!='frames'},indent=2))
