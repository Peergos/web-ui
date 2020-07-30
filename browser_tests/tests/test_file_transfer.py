from controllers import *
import tempfile

def test_hello_world():
    # create temp file
    temp_path=tempfile.mktemp()
    msg = 'Hello World'
    with open(temp_path,'w') as f:
        f.write(msg)
    
    temp_fname = os.path.basename(temp_path)
    with signup_to_homedir() as fs_page:
        # upload file
        fs_page.upload_file(temp_path)
        # download file
        fs_page.download_file(temp_fname)
        # check file downloaded
        expected_f = fs_page.download_path(temp_fname)

    assert os.path.isfile(expected_f)
    # check contents
    with open(expected_f) as f:
        downloaded = f.read()
    assert downloaded == msg
    
