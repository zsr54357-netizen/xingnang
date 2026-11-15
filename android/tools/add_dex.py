import shutil
import sys
import zipfile

source, dex, output = sys.argv[1], sys.argv[2], sys.argv[3]
shutil.copyfile(source, output)
with zipfile.ZipFile(output, 'a', zipfile.ZIP_DEFLATED) as archive:
    archive.write(dex, 'classes.dex')
print('added classes.dex to', output)
