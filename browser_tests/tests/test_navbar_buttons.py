from controllers import *
import os.path
import os
import tempfile
import pytest

@pytest.mark.skip
def test_home_button_has_home_folder():
    with driver_context() as driver:
        landing_page = LoginPage(driver)
        signup_page = landing_page.to_signup_page()
        filesystem_page = signup_page.signup()
        filesystem_page.go_home()
        xpath = "//div[@class='noselect' and text()='{}']".format(filesystem_page.username)
        filesystem_page.get_unique_xpath(xpath)


@pytest.mark.skip
def test_mkdir_and_upload_not_present_in_root():
    with driver_context() as driver:
        landing_page = LoginPage(driver)
        signup_page = landing_page.to_signup_page()
        filesystem_page = signup_page.signup()
        filesystem_page.go_home()
        for xpath in [
            "//span[@title='{}']".format("Create new directory"),
            "//span[@title='{}']".format("Upload file"),
        ]:
            assert not len(filesystem_page.d.find_elements_by_xpath(xpath))


@pytest.mark.skip
def test_mkdir():
    with driver_context() as driver:
        landing_page = LoginPage(driver)
        signup_page = landing_page.to_signup_page()
        filesystem_page = signup_page.signup()
        filesystem_page.click_on_file(filesystem_page.username)

        folder_name = randomUsername()
        filesystem_page.mkdir(folder_name)
        assert filesystem_page.d.find_element_by_id(folder_name) is not None


@pytest.mark.skip
@pytest.mark.parametrize('file_size', [101, 1024*97, 1024*1024* 6]) 
def test_binary_file_upload_and_download(file_size):
    # setup random data and temp file 
    tmp_path = tempfile.mktemp()
    data = randomData(file_size)
    with open(tmp_path, 'wb') as f:
        f.write(data)

    f_name = os.path.basename(tmp_path)
    
    # path where browser will download data
    download_path = os.path.join(os.path.expanduser('~'),
                                 'Downloads',
                                 f_name)

    # make sure file isn't already downloaded
    try:
        os.remove(download_path)
    except:
        pass

    with signup_to_homedir() as fs_page:
        assert fs_page.d.find_element_by_id(f_name) is None, 'File not in UI before upload'
        fs_page.upload_file(tmp_path)

        time.sleep(5)
        assert fs_page.d.find_element_by_id(f_name) is not None, 'Uploaded file in UI'
        fs_page.download(f_name)
        time.sleep(5)
    
    assert os.path.exists(download_path), 'File is downloaded'
    
    with open(download_path, 'rb') as f:
        downloaded_data = f.read()

    assert data == downloaded_data, 'Downloaded data is identical to uploaded data' 

    os.remove(download_path)


