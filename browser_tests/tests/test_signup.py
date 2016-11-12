from controllers import *

def test_login_page():
    with driver_context() as driver:
        LoginPage(driver)


def test_signup():
    with driver_context() as driver:
        landing_page = LoginPage(driver)
        signup_page = landing_page.to_signup_page()
        filesystem_page = signup_page.signup()
        
        logout = filesystem_page.get_unique_xpath("//button[@id='logoutButton']") 
        assert filesystem_page.username in logout.text


def test_logout():
    with driver_context() as driver:
        landing_page = LoginPage(driver)
        signup_page = landing_page.to_signup_page()
        filesystem_page = signup_page.signup()
        filesystem_page.logout()






