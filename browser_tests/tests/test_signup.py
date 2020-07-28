from controllers import *
import pytest

@pytest.mark.skip("Bored of this")
def test_login_page():
    with driver_context() as driver:
        LoginPage(driver)


@pytest.mark.skip("Bored of this")
def test_signup():
    with driver_context() as driver:
        landing_page = LoginPage(driver)
        signup_page = landing_page.to_signup_page()
        filesystem_page = signup_page.signup()
        
        logout = filesystem_page.get_unique_xpath("//button[@id='logoutButton']") 
        assert filesystem_page.username in logout.text


@pytest.mark.skip
def test_logout():
    with driver_context() as driver:
        landing_page = LoginPage(driver)
        signup_page = landing_page.to_signup_page()
        filesystem_page = signup_page.signup()
        filesystem_page.logout()


@pytest.mark.skip
def test_signup_and_login():
    # sign up in one browser session
    with driver_context() as driver:
        landing_page = LoginPage(driver)
        signup_page = landing_page.to_signup_page()
        filesystem_page = signup_page.signup()

        logout = filesystem_page.get_unique_xpath("//button[@id='logoutButton']")
        assert filesystem_page.username in logout.text

    #  login as same user
    with driver_context() as driver:
        username = filesystem_page.username
        password = filesystem_page.password
        landing_page = LoginPage(driver)
        landing_page.login(username, password)





