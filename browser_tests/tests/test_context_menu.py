from controllers import *
import pytest

@pytest.mark.skip
def test_context_menu():
    with signup_to_homedir() as filesystem:
        dir_name = randomUsername()
        filesystem.mkdir(dir_name)
        filesystem.context_click_on_file(dir_name)
        assert filesystem.d.find_element_by_id('right-click-menu') is not None


@pytest.mark.skip
def test_delete_folder():
    with signup_to_homedir() as filesystem:
        dir_name = randomUsername()
        filesystem.mkdir(dir_name)
        assert filesystem.d.find_element_by_id(dir_name) is not None
        filesystem.delete_file(dir_name)
        assert len(filesystem.d.find_elements_by_id(dir_name)) == 0


@pytest.mark.skip
def test_public_link_to_folder():
    with signup_to_homedir() as filesystem:
        dir_name = randomUsername()
        filesystem.mkdir(dir_name)
        filesystem.public_link(dir_name)
        public_link = filesystem.d.find_element_by_id('public_link_'+dir_name)
        assert public_link
        url = public_link.get_attribute('href')
        
    page = FileSystemPage(get_driver_on_page(url), None, None)
    assert page.d.find_element_by_xpath("//button[text()='{}']".format(dir_name))
        

@pytest.mark.skip
def test_rename():
    with signup_to_homedir() as filesystem:
        dir_name = randomUsername()
        filesystem.mkdir(dir_name)
        new_name = randomUsername()
        filesystem.rename(dir_name, new_name)
        assert len(filesystem.d.find_elements_by_id(dir_name)) == 0
        assert filesystem.d.find_elements_by_id(new_name)
