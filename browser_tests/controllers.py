"""Controllers for interacting with the Peergos web-app."""
import abc
import time
import sys
import uuid
import tempfile
from contextlib import contextmanager
import os
import os.path
import random

from selenium import webdriver
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.common.action_chains import ActionChains
from selenium.webdriver.common.desired_capabilities import DesiredCapabilities    

# get url from environment, default to localhost:8000
PEERGOS_URL = os.environ.get("PEERGOS_URL", "http://localhost:8000")
RUN_HEADLESS = os.environ.get("RUN_HEADLESS") in ('true', 'True', '1')
BINARY_LOCATION = os.environ.get("BINARY_LOCATION")


class PeergosError(Exception):
    """Package root exception."""
    pass


def randomData(length, seed=None):
    """generate random data string"""
    if seed is not None:
        random.seed(seed)
    return ''.join(chr(random.randint(0, 255)) for _ in xrange(length))


def randomUsername():
    """Generate a random guid string."""
    return str(uuid.uuid4())[0:32]


def get_driver(download_dir_path: str):
    """Returns a webdriver."""
    options = webdriver.ChromeOptions()
    if RUN_HEADLESS:
        #options.add_argument('--no-sandbox')
        #options.add_argument('--disable-dev-shm-usage')
        options.add_argument('--headless')
        #options.add_argument('--disable-extensions')
        #options.add_argument('--disable-popup-blocking')

        #options.add_argument('--disable-gpu')
        #options.add_argument('--window-size=1280,800')
        #options.add_argument('--user-data-dir=' + os.getcwd())
        #options.add_argument('--allow-insecure-localhost')
        #options.add_argument('--enable-logging')
        #options.add_argument('--log-level=0')
        #options.add_argument('--v=99')
        #options.add_argument('--single-process')
        #options.add_argument('--data-path=' + os.getcwd())
        #options.add_argument('--ignore-certificate-errors')
        #options.add_argument('--homedir=' + os.getcwd())
        #options.add_argument('--disk-cache-dir=' + os.getcwd())
    options.add_experimental_option("prefs", {
      "download.default_directory": download_dir_path,
      "download.prompt_for_download": False,
      "download.directory_upgrade": True,
      "safebrowsing.enabled": False, 
    })

    # needed to capture console.log
    desired = DesiredCapabilities.CHROME
    desired ['goog:loggingPrefs'] = { 'browser':'ALL' }

    driver = webdriver.Chrome("./chromedriver", chrome_options=options, desired_capabilities=desired)
    driver.download_path = download_dir_path
    return driver


def get_driver_on_page(url, download_dir_path: str):
    """Creates a webdriver and navigates it to url."""
    driver = get_driver(download_dir_path)
    driver.get(url)
    return driver


@contextmanager
def signup_to_homedir(username=None, password=None):
    """Signs up a new user, clicks on user directory.
    Parameters
    ----------
    username: `str`
        Username to  signup with.
    password: `str`
        Password to signup with.

    Yields
    ------
        On user home directory.
    """
    with driver_context() as driver:
        landing_page = LoginPage(driver)
        signup_page = landing_page.to_signup_page()
        app_page = signup_page.signup(username, password)
        filesystem_page = app_page.go_myfiles()
        yield filesystem_page


@contextmanager
def login_to_homedir(username, password):
    """
    Login as an existing user.

    Yields
    ------
    FileSystemPage
        On user home directory.
    """
    with driver_context() as driver:
        landing_page = LoginPage(driver)
        filesystem = landing_page.login(username, password)
        yield filesystem.go_home()


@contextmanager
def driver_context(url=PEERGOS_URL, screenshot_file="screenshot.png", download_dir_path=None, print_browser_console_log_on_failure=True):
    """
    context-manager that prints exception info. and creates a screenshot
    on error.

    Parameters
    ----------
    url: `str`
        Peergos web app url.
    screenshot_file: `str`
        Path to store screenshot file.
    """
    if download_dir_path is None:
        download_dir_path = tempfile.mkdtemp(prefix="peergos-ui-test")
    driver = get_driver_on_page(url, download_dir_path)

    try:
        yield driver
    except Exception as e:
        print(f"Screenshot of browser on latest failure at {screenshot_file}")
        driver.get_screenshot_as_file(screenshot_file)
        if print_browser_console_log_on_failure:
            print("*"*20)
            print("Browser console log")
            print("*"*20)
            print('\n'.join([l['message'] for l in driver.get_log("browser")]))
        raise e
    finally:
        driver.quit()


def require_unique(driver, *xpaths):
    """
    Requires a collection of unique xpaths appear on a page.

    Parameters
    ----------
    driver: `WebDriver`
    xpaths: `list`
    """
    for xpath in xpaths:
        elems = driver.find_elements_by_xpath(xpath)
        count = len(elems)
        if not count:
            raise PeergosError("Could not find xpath {}.".format(xpath))
        elif 1 < count:
            raise PeergosError(
                "xpath {} has {} entries, should have 1.".format(xpath, str(count)))


class Page(object):
    '''A controller for interacting  with a `page` on the Peergos web-app.'''

    __metaclass__ = abc.ABCMeta

    def __init__(self, driver):
        self.driver = driver
        time.sleep(self._init_sleep())
        if not self._is_valid():
            raise PeergosError("invalid page " + str(self.__class__))

    @classmethod
    def _init_sleep(cls):
        """The initial time period in seconds to wait for the page  to load in the constructor."""
        return 1

    @abc.abstractmethod
    def _is_valid(self):
        """Called in the constructor to check if the page has the correct content.

        Returns
        -------
        bool
        """
        pass

    @property
    def d(self):
        """A short-hand for the driver attribute."""
        return self.driver

    def download_path(self, path: str):
        return os.path.join(self.d.download_path,  path)


    def get_source(self):
        """Returns the page source that the driver is currently on."""
        return self.d.page_source.encode("utf-8")

    def get_unique_xpath(self, xpath):
        """
        Gets a web-element matching an xpath expression.

        Parameters
        ----------
        xpath: `str`
            An xpath selector.

        Returns
        -------
        WebElement
            The web-element on the page matching xpath.

        Raises
        ------
        PeergosError
            When there is not exactly one element matching xpath.
        """
        elems = self.d.find_elements_by_xpath(xpath)
        if not len(elems) == 1:
            raise PeergosError(
                "non unique path {} : {}".format(xpath, str(elems)))
        return elems[0]

    def double_click(self, elem):
        """
        Double click action on elem.

        Parameters
        ----------
        elem: `WebElement`
            The WebElement to be double clicked on.
        """
        a_chain = ActionChains(self.d)
        a_chain.double_click(elem).perform()
        return FileSystemPage(self.d)

    def context_click(self, elem):
        """
        Context  click action on elem.

        Parameters
        ----------
        elem: `WebElement`
            The WebElement to be double clicked on.
        """
        a_chain = ActionChains(self.d)
        a_chain.context_click(elem).perform()


class LoginPage(Page):
    """The landing page."""

    def _is_valid(self):
        self.get_unique_xpath("//h4[text()='Please log in']")
        self.get_unique_xpath("//input[@id='username']")
        self.get_unique_xpath("//input[@name='password']")
        self.get_unique_xpath("//button[text()='Login']")
        return True

    def to_signup_page(self):
        """Navigate to the signup page.

        Returns
        -------
        SignupPage
        """
        signup = self.get_unique_xpath("//button[text()='Sign Up']")
        signup.click()
        return SignupPage(self.d)

    def login(self, username, password):
        """
        Login with user credentials.

        Returns
        -------
        FileSystemPage
            The filesystem page logged in with user credentials.
        """
        self.get_unique_xpath("//input[@id='username']").send_keys(username)
        self.get_unique_xpath("//input[@name='password']").send_keys(password)
        self.get_unique_xpath("//button[text()='Login']").click()
        self.d.implicitly_wait(20)  # seconds
        logout = self.d.find_element_by_id("logoutButton")
        
        return FileSystemPage(self.d, username, password)


class SignupPage(Page):
    """Page with signup inputs."""

    def _is_valid(self):
        self.get_unique_xpath("//input[@id='password2']")
        return True

    def signup(self, username=None, password=None):
        """Sign up to Peergos.

        Parameters
        ----------
        username: `str`
            Username to signup with.
            Defaults to a random username when None.
        password: `str`
            Password to signup with.
            Defaults to a random username when None.

        Returns
        -------
        FileSystemPage
            As the new user.
        """
        username_input = self.get_unique_xpath("//input[@id='username']")
        password1_input = self.get_unique_xpath("//input[@id='password']")
        password2_input = self.get_unique_xpath("//input[@id='password2']")

        if username is None:
            username = randomUsername()
        if password is None:
            password = randomUsername()

        username_input.send_keys(username)
        password1_input.send_keys(password)
        password2_input.send_keys(password)

        # tick the boxes
        self.get_unique_xpath("//input[@id='safePassword']").click()
        self.get_unique_xpath("//input[@id='tosAccepted']").click()
        # signup time
        self.get_unique_xpath("//button[text()='Sign up']").click()
        self.d.implicitly_wait(20)  # seconds 
        logout = self.d.find_element_by_id("logoutButton")
        self.d.find_element_by_id('skip-tour-modal-button-id').click()
        return AppPage(self.d, username, password)

class AppPage(Page):
    """App icon grid."""

    def __init__(self, driver, username, password):
        super(AppPage, self).__init__(driver)
        self.username = username
        self.password = password

    def _is_valid(self):
        xpaths = [
            "//a[@id='ourFilesButton']",
        ]
        require_unique(self.d, *xpaths)
        return True

    def go_myfiles(self):
        self.get_unique_xpath("//a[@id='ourFilesButton']").click()
        self.d.implicitly_wait(2)  # seconds 
        return FileSystemPage(self.d, self.username, self.password)

class FileSystemPage(Page):
    """Filesystem view page in grid mode."""

    def __init__(self, driver, username, password):
        super(FileSystemPage, self).__init__(driver)
        self.username = username
        self.password = password

    def _is_valid(self):
        xpaths = [
            "//button[@id='logoutButton']",
            #"//li[@id='alternateViewButton']",
            #"//li[@id='userOptionsButton']",
            #"//a[@id='pathSpan']",
        ]
        require_unique(self.d, *xpaths)
        return True

    def go_home(self):
        self.get_unique_xpath("//li[@id='appButton']").click()
        self.d.implicitly_wait(1)  # seconds 
        self.get_unique_xpath("//a[@id='homeButton']").click()
        return FileSystemPage(self.d, self.username, self.password)

    def logout(self):
        self.get_unique_xpath("//button[@id='logoutButton']").click()
        self.get_unique_xpath("//a[text()='Log out']").click()
        return LoginPage(self.d)

    def click_on_file(self, filename):
        self.d.find_element_by_id(filename).click()
        return FileSystemPage(self.d, self.username, self.password)

    def double_click_on_file(self, filename):
        """
        Double click the file/folder by name.

        Returns
        -------
        FileSystemPage
            The filesystem after  clicking on filename.
        """
        elem = self.d.find_element_by_id(filename)
        self.double_click(elem)
        return FileSystemPage(self.d)

    def context_click_on_file(self, filename):
        elem = self.d.find_element_by_id(filename)
        self.context_click(elem)
        return FileSystemPage(self.d, self.username, self.password)

    def delete_file(self, filename):
        """delete file in current directory."""
        self.context_click_on_file(filename)
        self.d.find_element_by_id('delete-file').click()
        return FileSystemPage(self.d, self.username, self.password)

    def public_link(self, filename):
        """open the context menu for filename and click the public-link option."""
        self.context_click_on_file(filename)
        self.d.find_element_by_id('public-link-file').click()
        return FileSystemPage(self.d, self.username, self.password)

    def mkdir(self, folder_name):
        """
        Click mkdir button.

        Parameters
        ----------
        folder_name: str
            Send keys  after  clicking mkdir.

        Returns
        -------
        FileSystemPage
            After confirming mkdir.
        """
        self.get_unique_xpath("//li[@id='mkdirButton']").click()
        self.d.find_element_by_id('prompt-input').send_keys(folder_name)
        self.d.find_element_by_id('prompt-button-id').click()
        return FileSystemPage(self.d, self.username, self.password)

    def download_file(self, file_name):
        """Download a file in the current view.

        Parameters
        ----------
        file_name: `str`
            Name of file to download.
        """
        self.d.find_element_by_id(file_name).click()
        self.d.find_element_by_id('open-file').click()
        # TODO wait until it is finished downloading
        time.sleep(3) 

    def rename(self, current_name, new_name):
        """
        Rename a file/folder.

        Parameters
        ----------
        current_name: `str`
        new_name: `str`

        Returns
        -------
        FileSystemPage
            After confirming rename.
        """
        self.context_click_on_file(current_name)
        self.d.find_element_by_id('rename-file').click()
        self.d.find_element_by_id('prompt-input').send_keys(new_name)
        self.d.find_element_by_id('prompt-button-id').click()
        return FileSystemPage(self.d, self.username, self.password)

    def upload_file(self, file_path):
        """
        Upload local file to Peergos by clicking upload button.
        """
        #self.d.find_element_by_id("uploadButton").click()
        self.d.find_element_by_id('uploadFileInput').send_keys(file_path)
            
        return FileSystemPage(self.d, self.username, self.password)

    @classmethod
    def _init_sleep(cls):
        return 4

    def _open_social(self):
        self.d.find_element_by_id('sharingOptionsSpan').click()

    def _close_social(self):
        # todo
        pass

    def send_follow_request(self, to_friend):
        """Send a friend request to another user."""
        self._open_social()
        self.d.find_element_by_id('friend-name-input').send_keys(to_friend)
        self.d.find_element_by_id('send-follow-request-id').click()
        return FileSystemPage(self.d, self.username, self.password)

    def get_pending_follow_request(self):
        """Get a list of the  usernames for which this user has a pending users-follow-requests."""
        self._open_social()
        table = self.d.find_element_by_id('follow-request-table-id')
        # request_elems = table.find_elements_by_xpath("//td[contains(@id,'follow-request')]")
        request_elems = table.find_elements_by_xpath(
            "//td[@id='follow-request-id']")
        self._close_social()
        return [e.text for e in request_elems]

    def get_followers(self):
        """Get a list of the usernames in the followers table."""
        self._open_social()
        table = self.d.find_element_by_id('follower-table-id')
        follower_user_names = [
            elem.text for elem in table.find_elements_by_id('follower-id')]
        self._close_social()
        return follower_user_names

    def _mutate_follow_requet(self, from_user, suffix):
        self._open_social()
        button_id = "_".join([from_user, suffix])
        button = self.d.find_element_by_id(button_id)
        button.click()
        self._close_social()
        return FileSystemPage(self.d, self.username, self.password)

    def accept_follow_request(self, from_user):
        """Accept a pending follow request from a user."""
        return self._mutate_follow_requet(from_user, 'allow-follow-request-id')

    def accept_follow_request_and_follow_back(self, from_user):
        """Accept a pending follow request from a user and follow them back."""
        return self._mutate_follow_requet(from_user, 'allow-and-follow-back-id')

    def deny_follow_request(self, from_user):
        """Accept a pending follow request from a user."""
        return self._mutate_follow_requet(from_user, 'deny-follow-request-id')
