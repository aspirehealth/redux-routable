import { createPath } from 'history'
import PropTypes from 'prop-types'
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react'
import { connect } from 'react-redux'
import {
  Router,
  locationToRoute,
  open,
  push,
  replace,
  routeToLocation,
} from 'redux-routable'

const RouterContext = createContext()
const CurrentRouteContext = createContext()

// Routable
export const Routable = ({ router, history, children }) => {
  const initialRoute = locationToRoute(router, history.location).route
  const [currentRoute, setCurrentRoute] = useState(initialRoute)

  useEffect(
    () =>
      history.listen(location => {
        setCurrentRoute(locationToRoute(router, location).route)
      }),
    [router, history],
  )

  return (
    <RouterContext.Provider value={router}>
      <CurrentRouteContext.Provider value={currentRoute}>
        {children}
      </CurrentRouteContext.Provider>
    </RouterContext.Provider>
  )
}

Routable.propTypes = {
  router: PropTypes.instanceOf(Router).isRequired,
  history: PropTypes.object.isRequired,
  children: PropTypes.node,
}

// Match
export const Match = ({ route, children }) => {
  const currentRoute = useContext(CurrentRouteContext)
  const routes = route instanceof Array ? route : [route]
  const match = routes.includes(currentRoute.name)

  return match ? children : null
}

Match.propTypes = {
  route: PropTypes.oneOfType([
    PropTypes.string,
    PropTypes.arrayOf(PropTypes.string),
  ]).isRequired,
  children: PropTypes.node,
}

// Link
const linkActionCreators = { push, replace, open }

const isModifiedEvent = event =>
  event.metaKey || event.altKey || event.ctrlKey || event.shiftKey

export const Link = connect()(
  ({
    component: Component,
    action,
    route,
    params,
    hash,
    onClick,
    dispatch,
    ...props
  }) => {
    const router = useContext(RouterContext)
    const location = routeToLocation(router, route, params, hash)
    const href = createPath(location)
    const target = props.target || '_self'

    const handleClick = useCallback(
      event => {
        if (onClick) onClick(event)

        if (
          !event.defaultPrevented &&
          event.button === 0 &&
          target === '_self' &&
          !isModifiedEvent(event)
        ) {
          const actionCreator = linkActionCreators[action]
          const linkAction = actionCreator(route, params, hash)

          event.preventDefault()
          dispatch(linkAction)
        }
      },
      [target, action, route, params, hash, onClick],
    )

    return <Component {...props} href={href} onClick={handleClick} />
  },
)

Link.propTypes = {
  component: PropTypes.oneOfType([PropTypes.string, PropTypes.func]),
  action: PropTypes.oneOf(['push', 'replace', 'open']),
  route: PropTypes.string.isRequired,
  params: PropTypes.objectOf(PropTypes.string),
  hash: PropTypes.string,
  onClick: PropTypes.func,
}

Link.defaultProps = {
  component: 'a',
  action: 'push',
  params: {},
  hash: '',
}
